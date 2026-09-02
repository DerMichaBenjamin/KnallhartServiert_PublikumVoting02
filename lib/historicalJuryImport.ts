import 'server-only';

import { randomBytes, randomUUID } from 'node:crypto';
import manifestJson from '@/data/historical-jury-votes-2026.json';
import { getSetting, setSetting } from './settings';
import { getSupabaseAdminClient } from './supabaseAdmin';

const PAGE_SIZE = 1000;
const ITEM_CHUNK_SIZE = 500;
const OVERRIDES_SETTING_KEY = 'historical_jury_import_overrides_v2';

export type HistoricalVoteCategory = 'jury' | 'dj';
export const HISTORICAL_MAPPING_AUTO = '__auto__';
export const HISTORICAL_MAPPING_NEW = '__new__';
export const HISTORICAL_MAPPING_IGNORE = '__ignore__';

type ManifestRankingItem = { songLabel: string; points: number };
type ManifestJuror = { sourceName: string; displayName: string; category: HistoricalVoteCategory; ranking: ManifestRankingItem[] };
type ManifestSkippedColumn = {
  sourceName: string;
  displayName: string;
  category: HistoricalVoteCategory;
  reason: string;
  rankingCount: number;
  sum: number;
  missingPoints: number[];
  duplicatePoints: Array<{ point: number; count: number }>;
  nonRankingNumbers: number[];
  ranking: ManifestRankingItem[];
};
type ManifestRound = {
  sheet: string;
  votingDate: string;
  songsInSheet: number;
  zonkEntries: number;
  jurors: ManifestJuror[];
  skippedColumns: ManifestSkippedColumn[];
};
type Manifest = { schemaVersion: number; sourceFile: string; rounds: ManifestRound[] };

type DatabaseRound = { id: string; slug: string; title: string; starts_at: string | null; ends_at: string | null; created_at: string };
type DatabaseSong = { id: string; round_id: string; title: string; artist: string; sort_order: number };
type DatabaseProfile = { id: string; name: string };
type DatabaseJuror = {
  id: string;
  round_id: string;
  profile_id: string | null;
  display_name: string;
  voting_role: HistoricalVoteCategory;
  is_active: boolean;
};
type DatabaseVote = { id: string; round_id: string; round_juror_id: string; submitted_at: string };
type DatabaseVoteItem = { vote_id: string; song_id: string; points: number };

export type HistoricalImportOverrides = {
  version: 2;
  roundMappings: Record<string, string>;
  songMappings: Record<string, Record<string, string>>;
  jurorMappings: Record<string, Record<string, string>>;
  rankingCorrections: Record<string, Record<string, ManifestRankingItem[]>>;
};

export type HistoricalJuryMatchReview = {
  sourceSong: string;
  matchedSong: string;
  strategy: 'ellipsis' | 'reversed' | 'fuzzy' | 'manual';
  confidence: number;
};

export type HistoricalJuryJurorReport = {
  sourceName: string;
  displayName: string;
  category: HistoricalVoteCategory;
  status: 'ready-new' | 'ready-existing' | 'already-imported' | 'blocked' | 'conflict' | 'ignored';
  message: string;
  matchedSongs: number;
  matchReviews: HistoricalJuryMatchReview[];
  missingSongs: Array<{ sourceSong: string; suggestions: string[]; mappingValue: string }>;
  jurorMappingValue: string;
};

export type HistoricalSkippedColumnReport = ManifestSkippedColumn & {
  corrected: boolean;
  ignored: boolean;
  currentRanking: ManifestRankingItem[];
};

export type HistoricalJuryRoundReport = {
  sheet: string;
  votingDate: string;
  sourceSongs: number;
  targetRound: { id: string; title: string } | null;
  roundMappingValue: string;
  status: 'ready' | 'partial' | 'blocked' | 'complete';
  jurors: HistoricalJuryJurorReport[];
  skippedColumns: HistoricalSkippedColumnReport[];
  zonkEntries: number;
  songOptions: Array<{ id: string; label: string }>;
  jurorOptions: Array<{ id: string; displayName: string; category: HistoricalVoteCategory }>;
};

export type HistoricalJuryImportReport = {
  sourceFile: string;
  generatedAt: string;
  roundOptions: Array<{ id: string; title: string; period: string }>;
  summary: {
    sourceRounds: number;
    matchedRounds: number;
    validSourceVotes: number;
    validJuryVotes: number;
    validDjVotes: number;
    readyVotes: number;
    readyJuryVotes: number;
    readyDjVotes: number;
    alreadyImportedVotes: number;
    blockedVotes: number;
    conflictingVotes: number;
    ignoredVotes: number;
    skippedSourceColumns: number;
    invalidSourceVotes: number;
    emptySourceColumns: number;
    zonkEntriesNotImported: number;
    reviewedSongMatches: number;
  };
  rounds: HistoricalJuryRoundReport[];
};

type PreparedJuror = {
  sourceRound: ManifestRound;
  targetRound: DatabaseRound;
  sourceJuror: ManifestJuror;
  report: HistoricalJuryJurorReport;
  profileId: string | null;
  existingJuror: DatabaseJuror | null;
  existingVote: DatabaseVote | null;
  items: Array<{ song_id: string; points: number }>;
};

type ImportPlan = { report: HistoricalJuryImportReport; prepared: PreparedJuror[] };
const manifest = manifestJson as Manifest;

function emptyOverrides(): HistoricalImportOverrides {
  return { version: 2, roundMappings: {}, songMappings: {}, jurorMappings: {}, rankingCorrections: {} };
}

async function loadOverrides(): Promise<HistoricalImportOverrides> {
  const raw = await getSetting(OVERRIDES_SETTING_KEY, '');
  if (!raw) return emptyOverrides();
  try {
    const parsed = JSON.parse(raw) as Partial<HistoricalImportOverrides>;
    return {
      version: 2,
      roundMappings: parsed.roundMappings && typeof parsed.roundMappings === 'object' ? parsed.roundMappings : {},
      songMappings: parsed.songMappings && typeof parsed.songMappings === 'object' ? parsed.songMappings : {},
      jurorMappings: parsed.jurorMappings && typeof parsed.jurorMappings === 'object' ? parsed.jurorMappings : {},
      rankingCorrections: parsed.rankingCorrections && typeof parsed.rankingCorrections === 'object' ? parsed.rankingCorrections : {},
    };
  } catch {
    throw new Error('Die gespeicherten Import-Zuordnungen sind beschädigt. Bitte app_settings prüfen.');
  }
}

function chunks<T>(rows: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}

function normalize(value: unknown) {
  return String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de-DE')
    .replace(/ß/g, 'ss').replace(/&/g, 'und').replace(/\b(feat|featuring|ft)\.?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}

function canonicalJurorKey(value: unknown) {
  const key = normalize(value);
  if (key === 'marcus' || key === 'djmarcusaurelius') return 'djmarcusaurelius';
  if (key === 'micha' || key === 'michabenjamin') return 'michabenjamin';
  if (key === 'meiki' || key === 'meikicruise') return 'meikicruise';
  if (key === 'djs' || key === 'djgesamtwertung') return 'djgesamtwertung';
  return key;
}

function germanDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${Number(day)}.${Number(month)}.${year}`;
}

function datesInText(value: unknown) {
  const result = new Set<string>();
  for (const match of String(value || '').matchAll(/(\d{1,4})[.\-_/](\d{1,2})[.\-_/](\d{1,4})/g)) {
    let year: number;
    let month: number;
    let day: number;
    if (match[1].length === 4) {
      year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
    } else {
      day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
      if (year < 100) year += 2000;
    }
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      result.add(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
  }
  return result;
}

function roundMatchScore(round: DatabaseRound, votingDate: string) {
  let score = 0;
  if (round.ends_at?.slice(0, 10) === votingDate) score += 8;
  if (datesInText(round.title).has(votingDate)) score += 6;
  if (datesInText(round.slug).has(votingDate)) score += 4;
  return score;
}

function matchRound(rounds: DatabaseRound[], source: ManifestRound) {
  const candidates = rounds.map((round) => ({ round, score: roundMatchScore(round, source.votingDate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.round.title.localeCompare(b.round.title, 'de'));
  if (!candidates.length || (candidates[1] && candidates[0].score === candidates[1].score)) return null;
  return candidates[0].round;
}

function ngrams(value: string, size = 3) {
  if (value.length <= size) return [value];
  const result: string[] = [];
  for (let index = 0; index <= value.length - size; index += 1) result.push(value.slice(index, index + size));
  return result;
}

function similarity(left: string, right: string) {
  const a = ngrams(left);
  const b = ngrams(right);
  const counts = new Map<string, number>();
  for (const value of a) counts.set(value, (counts.get(value) || 0) + 1);
  let intersection = 0;
  for (const value of b) {
    const remaining = counts.get(value) || 0;
    if (remaining > 0) { intersection += 1; counts.set(value, remaining - 1); }
  }
  return a.length + b.length ? (2 * intersection) / (a.length + b.length) : 0;
}

function ellipsisMatches(source: string, candidate: string) {
  if (!/(?:\.{2,}|…)/.test(source)) return false;
  const parts = source.split(/(?:\.{2,}|…)+/).map(normalize).filter((part) => part.length >= 3);
  if (!parts.length) return false;
  let offset = 0;
  for (const part of parts) {
    const index = candidate.indexOf(part, offset);
    if (index < 0) return false;
    offset = index + part.length;
  }
  return true;
}

type SongMatch = {
  song: DatabaseSong | null;
  strategy: 'exact' | 'ellipsis' | 'reversed' | 'fuzzy' | 'manual' | 'missing';
  confidence: number;
  suggestions: string[];
};

function matchSong(sourceLabel: string, songs: DatabaseSong[], manualSongId?: string): SongMatch {
  if (manualSongId) {
    const manual = songs.find((song) => song.id === manualSongId) || null;
    return manual
      ? { song: manual, strategy: 'manual', confidence: 1, suggestions: [] }
      : { song: null, strategy: 'missing', confidence: 0, suggestions: ['Gespeicherte Zuordnung gehört nicht mehr zu dieser Umfrage.'] };
  }
  const source = normalize(sourceLabel);
  const rows = songs.map((song) => {
    const forward = normalize(`${song.title} - ${song.artist}`);
    const reversed = normalize(`${song.artist} - ${song.title}`);
    return { song, forward, reversed, score: Math.max(similarity(source, forward), similarity(source, reversed)) };
  });
  const exact = rows.filter((entry) => entry.forward === source);
  if (exact.length === 1) return { song: exact[0].song, strategy: 'exact', confidence: 1, suggestions: [] };
  const shortened = rows.filter((entry) => ellipsisMatches(sourceLabel, entry.forward));
  if (shortened.length === 1) return { song: shortened[0].song, strategy: 'ellipsis', confidence: shortened[0].score, suggestions: [] };
  const reversed = rows.filter((entry) => entry.reversed === source);
  if (reversed.length === 1) return { song: reversed[0].song, strategy: 'reversed', confidence: 1, suggestions: [] };
  const sorted = [...rows].sort((a, b) => b.score - a.score || a.song.sort_order - b.song.sort_order);
  const best = sorted[0];
  const second = sorted[1];
  if (best && best.score >= 0.9 && (!second || best.score - second.score >= 0.06)) {
    return { song: best.song, strategy: 'fuzzy', confidence: best.score, suggestions: [] };
  }
  return {
    song: null, strategy: 'missing', confidence: best?.score || 0,
    suggestions: sorted.slice(0, 3).filter((entry) => entry.score >= 0.45).map((entry) => `${entry.song.title} – ${entry.song.artist}`),
  };
}

function itemsEqual(existing: DatabaseVoteItem[], expected: Array<{ song_id: string; points: number }>) {
  if (existing.length !== expected.length) return false;
  const map = new Map(existing.map((item) => [item.song_id, Number(item.points)]));
  return expected.every((item) => map.get(item.song_id) === item.points);
}

async function fetchAllRounds() {
  const sb = getSupabaseAdminClient();
  if (!sb) throw new Error('Supabase ist nicht konfiguriert.');
  const rows: DatabaseRound[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb.from('release_voting_rounds').select('id,slug,title,starts_at,ends_at,created_at').order('created_at').range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as DatabaseRound[]));
    if ((data || []).length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchRoundScopedRows<T>(table: string, columns: string, roundIds: string[]) {
  const sb = getSupabaseAdminClient();
  if (!sb || !roundIds.length) return [] as T[];
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb.from(table).select(columns).in('round_id', roundIds).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as T[]));
    if ((data || []).length < PAGE_SIZE) break;
  }
  return rows;
}

async function fetchVoteItems(voteIds: string[]) {
  const sb = getSupabaseAdminClient();
  if (!sb || !voteIds.length) return [] as DatabaseVoteItem[];
  const rows: DatabaseVoteItem[] = [];
  for (const ids of chunks(voteIds, 70)) {
    const { data, error } = await sb.from('release_voting_jury_vote_items').select('vote_id,song_id,points').in('vote_id', ids);
    if (error) throw error;
    rows.push(...((data || []) as DatabaseVoteItem[]));
  }
  return rows;
}

function validateCorrection(ranking: ManifestRankingItem[]) {
  const active = ranking.filter((item) => Number(item.points) > 0);
  const points = active.map((item) => Number(item.points));
  const expected = Array.from({ length: 12 }, (_, index) => index + 1);
  return active.length === 12 && new Set(active.map((item) => item.songLabel)).size === 12
    && new Set(points).size === 12 && points.every(Number.isInteger)
    && [...new Set(points)].sort((a, b) => a - b).every((point, index) => point === expected[index]);
}

export async function saveHistoricalImportMapping(input: {
  type: 'round' | 'song' | 'juror' | 'ranking';
  sheet: string;
  sourceName?: string;
  sourceSong?: string;
  value?: string;
  ranking?: ManifestRankingItem[];
}) {
  const sourceRound = manifest.rounds.find((round) => round.sheet === input.sheet);
  if (!sourceRound) throw new Error('Diese Excel-Woche ist unbekannt.');
  const overrides = await loadOverrides();
  if (input.type === 'round') {
    if (input.value) overrides.roundMappings[input.sheet] = input.value;
    else delete overrides.roundMappings[input.sheet];
  } else if (input.type === 'song') {
    const sourceSong = String(input.sourceSong || '').trim();
    const known = [...sourceRound.jurors, ...sourceRound.skippedColumns].some((juror) => juror.ranking.some((item) => item.songLabel === sourceSong));
    if (!sourceSong || !known) throw new Error('Der Excel-Song wurde in dieser Woche nicht gefunden.');
    overrides.songMappings[input.sheet] ||= {};
    if (input.value) overrides.songMappings[input.sheet][sourceSong] = input.value;
    else delete overrides.songMappings[input.sheet][sourceSong];
  } else if (input.type === 'juror') {
    const sourceName = String(input.sourceName || '').trim();
    const known = [...sourceRound.jurors, ...sourceRound.skippedColumns].some((juror) => juror.sourceName === sourceName);
    if (!sourceName || !known) throw new Error('Diese Excel-Juryspalte wurde nicht gefunden.');
    overrides.jurorMappings[input.sheet] ||= {};
    if (input.value && input.value !== HISTORICAL_MAPPING_AUTO) overrides.jurorMappings[input.sheet][sourceName] = input.value;
    else delete overrides.jurorMappings[input.sheet][sourceName];
  } else {
    const sourceName = String(input.sourceName || '').trim();
    const skipped = sourceRound.skippedColumns.find((column) => column.sourceName === sourceName);
    if (!skipped || !skipped.rankingCount) throw new Error('Für diese Spalte gibt es keine korrigierbare Rangliste.');
    overrides.rankingCorrections[input.sheet] ||= {};
    if (!input.ranking) {
      delete overrides.rankingCorrections[input.sheet][sourceName];
    } else {
      const allowedLabels = new Set(skipped.ranking.map((item) => item.songLabel));
      const normalized = input.ranking.map((item) => ({ songLabel: String(item.songLabel || '').trim(), points: Number(item.points) }));
      if (normalized.some((item) => !allowedLabels.has(item.songLabel)) || !validateCorrection(normalized)) {
        throw new Error('Die Korrektur muss genau zwölf verschiedene Songs mit den eindeutigen Punkten 12 bis 1 enthalten.');
      }
      overrides.rankingCorrections[input.sheet][sourceName] = normalized;
    }
  }
  await setSetting(OVERRIDES_SETTING_KEY, JSON.stringify(overrides));
  return buildHistoricalJuryImportPlan();
}

export async function buildHistoricalJuryImportPlan(): Promise<ImportPlan> {
  if (manifest.schemaVersion !== 2) throw new Error('Unbekannte Version der historischen Jury-Importdatei.');
  const sb = getSupabaseAdminClient();
  if (!sb) throw new Error('Supabase ist nicht konfiguriert.');
  const [databaseRounds, overrides] = await Promise.all([fetchAllRounds(), loadOverrides()]);
  const roundMatches = new Map(manifest.rounds.map((source) => {
    const manualId = overrides.roundMappings[source.sheet];
    return [source.sheet, manualId ? databaseRounds.find((round) => round.id === manualId) || null : matchRound(databaseRounds, source)] as const;
  }));
  const roundIds = [...new Set([...roundMatches.values()].filter((round): round is DatabaseRound => Boolean(round)).map((round) => round.id))];
  const [songs, jurors, votes, profileResult] = await Promise.all([
    fetchRoundScopedRows<DatabaseSong>('release_voting_songs', 'id,round_id,title,artist,sort_order', roundIds),
    fetchRoundScopedRows<DatabaseJuror>('release_voting_round_jurors', 'id,round_id,profile_id,display_name,voting_role,is_active', roundIds),
    fetchRoundScopedRows<DatabaseVote>('release_voting_jury_votes', 'id,round_id,round_juror_id,submitted_at', roundIds),
    sb.from('release_voting_jury_profiles').select('id,name'),
  ]);
  if (profileResult.error) throw profileResult.error;
  const profiles = (profileResult.data || []) as DatabaseProfile[];
  const voteItems = await fetchVoteItems(votes.map((vote) => vote.id));

  const songsByRound = new Map<string, DatabaseSong[]>();
  const jurorsByRound = new Map<string, DatabaseJuror[]>();
  const voteByJuror = new Map(votes.map((vote) => [vote.round_juror_id, vote]));
  const itemsByVote = new Map<string, DatabaseVoteItem[]>();
  for (const song of songs) songsByRound.set(song.round_id, [...(songsByRound.get(song.round_id) || []), song]);
  for (const juror of jurors) jurorsByRound.set(juror.round_id, [...(jurorsByRound.get(juror.round_id) || []), juror]);
  for (const item of voteItems) itemsByVote.set(item.vote_id, [...(itemsByVote.get(item.vote_id) || []), item]);
  const profilesByKey = new Map(profiles.map((profile) => [canonicalJurorKey(profile.name), profile]));

  const prepared: PreparedJuror[] = [];
  const roundReports: HistoricalJuryRoundReport[] = [];
  for (const sourceRound of manifest.rounds) {
    const targetRound = roundMatches.get(sourceRound.sheet) || null;
    const corrections = overrides.rankingCorrections[sourceRound.sheet] || {};
    const sourceJurors: ManifestJuror[] = [
      ...sourceRound.jurors,
      ...sourceRound.skippedColumns.filter((column) => Boolean(corrections[column.sourceName])).map((column) => ({
        sourceName: column.sourceName,
        displayName: column.displayName,
        category: column.category,
        ranking: corrections[column.sourceName],
      })),
    ];
    const jurorReports: HistoricalJuryJurorReport[] = [];
    const roundSongs = targetRound ? songsByRound.get(targetRound.id) || [] : [];
    const roundJurors = targetRound ? jurorsByRound.get(targetRound.id) || [] : [];
    const sourceLabels = [...new Set(sourceJurors.flatMap((juror) => juror.ranking.map((item) => item.songLabel)))];
    const songMatches = new Map(sourceLabels.map((label) => [label, matchSong(label, roundSongs, overrides.songMappings[sourceRound.sheet]?.[label])]));
    const collisions = new Map<string, string[]>();
    for (const [label, match] of songMatches) {
      if (match.song) collisions.set(match.song.id, [...(collisions.get(match.song.id) || []), label]);
    }

    for (const sourceJuror of sourceJurors) {
      const jurorMappingValue = overrides.jurorMappings[sourceRound.sheet]?.[sourceJuror.sourceName] || HISTORICAL_MAPPING_AUTO;
      if (jurorMappingValue === HISTORICAL_MAPPING_IGNORE) {
        jurorReports.push({ sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category,
          status: 'ignored', message: 'Diese Wertung wurde bewusst vom Import ausgeschlossen.', matchedSongs: 0,
          matchReviews: [], missingSongs: [], jurorMappingValue });
        continue;
      }
      if (!targetRound) {
        jurorReports.push({ sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category,
          status: 'blocked', message: `Keine eindeutige Umfrage für den ${germanDate(sourceRound.votingDate)} gefunden.`,
          matchedSongs: 0, matchReviews: [], missingSongs: [], jurorMappingValue });
        continue;
      }

      const matchReviews: HistoricalJuryMatchReview[] = [];
      const missingSongs: HistoricalJuryJurorReport['missingSongs'] = [];
      const items: Array<{ song_id: string; points: number }> = [];
      for (const item of sourceJuror.ranking.filter((entry) => Number(entry.points) > 0)) {
        const match = songMatches.get(item.songLabel);
        const collision = match?.song ? (collisions.get(match.song.id)?.length || 0) > 1 : false;
        if (!match?.song || collision) {
          missingSongs.push({ sourceSong: item.songLabel,
            suggestions: collision ? ['Mehrere Excel-Zeilen würden demselben Datenbank-Song zugeordnet.'] : (match?.suggestions || []),
            mappingValue: overrides.songMappings[sourceRound.sheet]?.[item.songLabel] || '' });
          continue;
        }
        items.push({ song_id: match.song.id, points: Number(item.points) });
        if (match.strategy !== 'exact' && match.strategy !== 'missing') {
          matchReviews.push({ sourceSong: item.songLabel, matchedSong: `${match.song.title} – ${match.song.artist}`,
            strategy: match.strategy, confidence: Math.round(match.confidence * 100) });
        }
      }

      const key = canonicalJurorKey(sourceJuror.displayName);
      const sameRoleJurors = roundJurors.filter((juror) => (juror.voting_role || 'jury') === sourceJuror.category);
      const automaticMatches = sameRoleJurors.filter((juror) => canonicalJurorKey(juror.display_name) === key);
      let existingJuror: DatabaseJuror | null = null;
      let invalidManualJuror = false;
      if (jurorMappingValue === HISTORICAL_MAPPING_NEW) existingJuror = null;
      else if (jurorMappingValue !== HISTORICAL_MAPPING_AUTO) {
        existingJuror = sameRoleJurors.find((juror) => juror.id === jurorMappingValue) || null;
        invalidManualJuror = !existingJuror;
      } else if (automaticMatches.length === 1) existingJuror = automaticMatches[0];
      const existingVote = existingJuror ? voteByJuror.get(existingJuror.id) || null : null;
      let report: HistoricalJuryJurorReport;
      if (missingSongs.length || items.length !== 12 || new Set(items.map((item) => item.song_id)).size !== 12) {
        report = { sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category, status: 'blocked',
          message: `${missingSongs.length || Math.max(0, 12 - items.length)} Song-Zuordnungen sind nicht eindeutig.`,
          matchedSongs: items.length, matchReviews, missingSongs, jurorMappingValue };
      } else if (invalidManualJuror) {
        report = { sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category, status: 'conflict',
          message: 'Die gespeicherte Zuordnung gehört nicht mehr zu dieser Umfrage oder Kategorie.',
          matchedSongs: 12, matchReviews, missingSongs: [], jurorMappingValue };
      } else if (jurorMappingValue === HISTORICAL_MAPPING_AUTO && automaticMatches.length > 1) {
        report = { sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category, status: 'conflict',
          message: 'Mehrere vorhandene Zuordnungen passen zu diesem Namen.', matchedSongs: 12, matchReviews, missingSongs: [], jurorMappingValue };
      } else if (existingVote) {
        const identical = itemsEqual(itemsByVote.get(existingVote.id) || [], items);
        report = { sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category,
          status: identical ? 'already-imported' : 'conflict',
          message: identical ? 'Diese Wertung ist bereits identisch vorhanden.' : 'Es existiert bereits eine abweichende oder unvollständige Wertung; sie wird nicht überschrieben.',
          matchedSongs: 12, matchReviews, missingSongs: [], jurorMappingValue };
      } else {
        report = { sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category,
          status: existingJuror ? 'ready-existing' : 'ready-new',
          message: existingJuror ? 'Vorhandene Zuordnung ohne Wertung wird ergänzt.' : `${sourceJuror.category === 'dj' ? 'DJ-Kategorie' : 'Juror'} und Wertung können neu angelegt werden.`,
          matchedSongs: 12, matchReviews, missingSongs: [], jurorMappingValue };
      }
      jurorReports.push(report);
      prepared.push({ sourceRound, targetRound, sourceJuror, report,
        profileId: sourceJuror.category === 'jury' ? profilesByKey.get(key)?.id || null : null,
        existingJuror, existingVote, items });
    }

    const skippedColumns: HistoricalSkippedColumnReport[] = sourceRound.skippedColumns.map((column) => ({
      ...column,
      corrected: Boolean(corrections[column.sourceName]),
      ignored: overrides.jurorMappings[sourceRound.sheet]?.[column.sourceName] === HISTORICAL_MAPPING_IGNORE,
      currentRanking: corrections[column.sourceName] || column.ranking,
    }));
    const ready = jurorReports.filter((juror) => juror.status === 'ready-new' || juror.status === 'ready-existing').length;
    const actionable = jurorReports.filter((juror) => juror.status !== 'ignored');
    const complete = actionable.length > 0 && actionable.every((juror) => juror.status === 'already-imported');
    const blocked = actionable.filter((juror) => juror.status === 'blocked' || juror.status === 'conflict').length
      + skippedColumns.filter((column) => !column.corrected && !column.ignored && column.rankingCount > 0).length;
    roundReports.push({
      sheet: sourceRound.sheet, votingDate: sourceRound.votingDate, sourceSongs: sourceRound.songsInSheet,
      targetRound: targetRound ? { id: targetRound.id, title: targetRound.title } : null,
      roundMappingValue: overrides.roundMappings[sourceRound.sheet] || '',
      status: complete ? 'complete' : ready > 0 && blocked > 0 ? 'partial' : ready > 0 ? 'ready' : blocked > 0 ? 'blocked' : 'complete',
      jurors: jurorReports, skippedColumns, zonkEntries: sourceRound.zonkEntries,
      songOptions: [...roundSongs].sort((a, b) => a.sort_order - b.sort_order).map((song) => ({ id: song.id, label: `${song.title} – ${song.artist}` })),
      jurorOptions: [...roundJurors].sort((a, b) => a.display_name.localeCompare(b.display_name, 'de'))
        .map((juror) => ({ id: juror.id, displayName: juror.display_name, category: juror.voting_role || 'jury' })),
    });
  }

  const allJurors = roundReports.flatMap((round) => round.jurors);
  const allSkipped = roundReports.flatMap((round) => round.skippedColumns);
  const valid = allJurors.filter((juror) => juror.status !== 'ignored');
  const ready = valid.filter((juror) => juror.status === 'ready-new' || juror.status === 'ready-existing');
  return {
    prepared,
    report: {
      sourceFile: manifest.sourceFile,
      generatedAt: new Date().toISOString(),
      roundOptions: [...databaseRounds].sort((a, b) => String(b.ends_at || b.created_at).localeCompare(String(a.ends_at || a.created_at)))
        .map((round) => ({ id: round.id, title: round.title,
          period: round.ends_at?.slice(0, 10) || round.starts_at?.slice(0, 10) || round.created_at.slice(0, 10) })),
      summary: {
        sourceRounds: manifest.rounds.length,
        matchedRounds: roundReports.filter((round) => Boolean(round.targetRound)).length,
        validSourceVotes: valid.length,
        validJuryVotes: valid.filter((juror) => juror.category === 'jury').length,
        validDjVotes: valid.filter((juror) => juror.category === 'dj').length,
        readyVotes: ready.length,
        readyJuryVotes: ready.filter((juror) => juror.category === 'jury').length,
        readyDjVotes: ready.filter((juror) => juror.category === 'dj').length,
        alreadyImportedVotes: valid.filter((juror) => juror.status === 'already-imported').length,
        blockedVotes: valid.filter((juror) => juror.status === 'blocked').length,
        conflictingVotes: valid.filter((juror) => juror.status === 'conflict').length,
        ignoredVotes: allJurors.filter((juror) => juror.status === 'ignored').length + allSkipped.filter((column) => column.ignored && !column.corrected).length,
        skippedSourceColumns: allSkipped.filter((column) => !column.corrected && !column.ignored).length,
        invalidSourceVotes: allSkipped.filter((column) => column.rankingCount > 0 && !column.corrected && !column.ignored).length,
        emptySourceColumns: allSkipped.filter((column) => column.rankingCount === 0 && !column.ignored).length,
        zonkEntriesNotImported: manifest.rounds.reduce((sum, round) => sum + round.zonkEntries, 0),
        reviewedSongMatches: valid.reduce((sum, juror) => sum + juror.matchReviews.length, 0),
      },
      rounds: roundReports,
    },
  };
}

function importedTimestamp(round: DatabaseRound, source: ManifestRound) {
  return round.ends_at || `${source.votingDate}T20:00:00.000Z`;
}

export async function importHistoricalJuryVotes() {
  const sb = getSupabaseAdminClient();
  if (!sb) throw new Error('Supabase ist nicht konfiguriert.');
  const plan = await buildHistoricalJuryImportPlan();
  const ready = plan.prepared.filter((entry) => entry.report.status === 'ready-new' || entry.report.status === 'ready-existing');
  const now = new Date().toISOString();
  const activateIds = [...new Set(plan.prepared
    .filter((entry) => entry.existingJuror && !entry.existingJuror.is_active && (entry.report.status === 'already-imported' || entry.report.status === 'ready-existing'))
    .map((entry) => entry.existingJuror!.id))];
  if (!ready.length) {
    if (activateIds.length) {
      const { error } = await sb.from('release_voting_round_jurors').update({ is_active: true, updated_at: now }).in('id', activateIds);
      if (error) throw error;
    }
    return { report: plan.report, importedVotes: 0, importedJuryVotes: 0, importedDjVotes: 0, activatedJurors: activateIds.length };
  }

  const staged = ready.map((entry) => ({ entry, jurorId: entry.existingJuror?.id || randomUUID(), voteId: randomUUID() }));
  const newJurors = staged.filter((row) => !row.entry.existingJuror).map((row) => ({
    id: row.jurorId,
    round_id: row.entry.targetRound.id,
    profile_id: row.entry.profileId,
    display_name: row.entry.sourceJuror.displayName,
    access_token: randomBytes(32).toString('base64url'),
    voting_role: row.entry.sourceJuror.category,
    is_active: true,
    created_at: importedTimestamp(row.entry.targetRound, row.entry.sourceRound),
    updated_at: now,
  }));
  const voteRows = staged.map((row) => ({ id: row.voteId, round_id: row.entry.targetRound.id, round_juror_id: row.jurorId,
    submitted_at: importedTimestamp(row.entry.targetRound, row.entry.sourceRound), updated_at: now }));
  const itemRows = staged.flatMap((row) => row.entry.items.map((item) => ({ vote_id: row.voteId, ...item })));
  const newJurorIds = newJurors.map((row) => row.id);
  const voteIds = voteRows.map((row) => row.id);

  try {
    if (newJurors.length) {
      const { error } = await sb.from('release_voting_round_jurors').insert(newJurors);
      if (error) throw error;
    }
    const { error: voteError } = await sb.from('release_voting_jury_votes').insert(voteRows);
    if (voteError) throw voteError;
    for (const batch of chunks(itemRows, ITEM_CHUNK_SIZE)) {
      const { error } = await sb.from('release_voting_jury_vote_items').insert(batch);
      if (error) throw error;
    }
  } catch (error) {
    if (voteIds.length) await sb.from('release_voting_jury_votes').delete().in('id', voteIds);
    if (newJurorIds.length) await sb.from('release_voting_round_jurors').delete().in('id', newJurorIds);
    throw error;
  }

  if (activateIds.length) {
    const { error } = await sb.from('release_voting_round_jurors').update({ is_active: true, updated_at: now }).in('id', activateIds);
    if (error) throw new Error(`Wertungen wurden importiert, aber ${activateIds.length} vorhandene Zuordnungen konnten nicht aktiviert werden: ${error.message}`);
  }
  const refreshed = await buildHistoricalJuryImportPlan();
  return {
    report: refreshed.report,
    importedVotes: voteRows.length,
    importedJuryVotes: staged.filter((row) => row.entry.sourceJuror.category === 'jury').length,
    importedDjVotes: staged.filter((row) => row.entry.sourceJuror.category === 'dj').length,
    activatedJurors: activateIds.length,
  };
}
