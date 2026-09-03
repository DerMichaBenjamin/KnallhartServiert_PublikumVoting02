import 'server-only';

import { randomBytes, randomUUID } from 'node:crypto';
import manifestJson from '@/data/historical-jury-votes-2026.json';
import roundSupplementsJson from '@/data/historical-jury-round-supplements-2026.json';
import { getSetting, setSetting } from './settings';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { normalizeSlug, type Round, type Song } from './releaseVotingShared';

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
type ManifestRoundSupplement = { sheet: string; songs: string[] };
type ManifestRoundSupplements = { schemaVersion: number; sourceFile: string; rounds: ManifestRoundSupplement[] };

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
  version: 3;
  roundMappings: Record<string, string>;
  songMappings: Record<string, Record<string, string>>;
  jurorMappings: Record<string, Record<string, string>>;
  rankingCorrections: Record<string, Record<string, ManifestRankingItem[]>>;
  ignoredReasons: Record<string, string>;
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
  missingSongs: Array<{
    sourceSong: string;
    suggestions: Array<{ id: string | null; label: string; confidence: number | null }>;
    mappingValue: string;
  }>;
  jurorMappingValue: string;
  suggestedJuror: { id: string; displayName: string; confidence: number } | null;
  ignoredReason: string;
};

export type HistoricalSkippedColumnReport = ManifestSkippedColumn & {
  kind: 'empty' | 'ranking-error' | 'dj-aggregate';
  corrected: boolean;
  ignored: boolean;
  ignoredReason: string;
  currentRanking: ManifestRankingItem[];
};

export type HistoricalJuryRoundReport = {
  sheet: string;
  votingDate: string;
  sourceSongs: number;
  targetRound: { id: string; title: string; slug: string; songsCount: number; audienceVotes: number } | null;
  suggestedRound: { id: string; title: string; slug: string; songsCount: number; audienceVotes: number; confidence: number } | null;
  roundMappingValue: string;
  status: 'ready' | 'partial' | 'blocked' | 'complete';
  jurors: HistoricalJuryJurorReport[];
  skippedColumns: HistoricalSkippedColumnReport[];
  zonkEntries: number;
  songOptions: Array<{ id: string; label: string }>;
  jurorOptions: Array<{ id: string; displayName: string; category: HistoricalVoteCategory }>;
  canCreateRound: boolean;
  sourceSongCatalogCount: number;
};

export type HistoricalJuryImportReport = {
  sourceFile: string;
  generatedAt: string;
  roundOptions: Array<{ id: string; title: string; slug: string; period: string; songsCount: number; audienceVotes: number }>;
  summary: {
    foundVotes: number;
    safeVotes: number;
    reviewVotes: number;
    errorVotes: number;
    openProblems: number;
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
    aggregateDjColumns: number;
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
const roundSupplements = roundSupplementsJson as ManifestRoundSupplements;
const supplementBySheet = new Map(roundSupplements.rounds.map((round) => [round.sheet, round]));

function emptyOverrides(): HistoricalImportOverrides {
  return { version: 3, roundMappings: {}, songMappings: {}, jurorMappings: {}, rankingCorrections: {}, ignoredReasons: {} };
}

async function loadOverrides(): Promise<HistoricalImportOverrides> {
  const raw = await getSetting(OVERRIDES_SETTING_KEY, '');
  if (!raw) return emptyOverrides();
  try {
    const parsed = JSON.parse(raw) as Partial<HistoricalImportOverrides>;
    return {
      version: 3,
      roundMappings: parsed.roundMappings && typeof parsed.roundMappings === 'object' ? parsed.roundMappings : {},
      songMappings: parsed.songMappings && typeof parsed.songMappings === 'object' ? parsed.songMappings : {},
      jurorMappings: parsed.jurorMappings && typeof parsed.jurorMappings === 'object' ? parsed.jurorMappings : {},
      rankingCorrections: parsed.rankingCorrections && typeof parsed.rankingCorrections === 'object' ? parsed.rankingCorrections : {},
      ignoredReasons: parsed.ignoredReasons && typeof parsed.ignoredReasons === 'object' ? parsed.ignoredReasons : {},
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
  if (['meikigaste', 'gast', 'gaste', 'gastjury', 'gastjuror', 'gastevoting'].includes(key)) return 'gastjury';
  if (key === 'djs' || key === 'djgesamtwertung') return 'djgesamtwertung';
  return key;
}

function historicalJurorDisplayName(sourceName: string, displayName: string) {
  return canonicalJurorKey(sourceName || displayName) === 'gastjury' ? 'Gastjury' : displayName;
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

function sourceSongLabels(source: ManifestRound) {
  return [...new Set([...source.jurors, ...source.skippedColumns]
    .flatMap((column) => column.ranking)
    .filter((item) => Number(item.points) > 0)
    .map((item) => item.songLabel))];
}

function sourceSongCatalog(source: ManifestRound) {
  const supplement = supplementBySheet.get(source.sheet);
  return supplement?.songs?.length ? supplement.songs : sourceSongLabels(source);
}

function matchedSourceSongs(source: ManifestRound, songs: DatabaseSong[]) {
  const matchedIds = new Set<string>();
  for (const label of sourceSongLabels(source)) {
    const match = matchSong(label, songs);
    if (match.song) matchedIds.add(match.song.id);
  }
  return matchedIds.size;
}

type RoundCandidate = {
  round: DatabaseRound;
  dateScore: number;
  songScore: number;
  songRatio: number;
  audienceVotes: number;
  unsuitable: boolean;
};

function rankRoundCandidates(
  rounds: DatabaseRound[],
  source: ManifestRound,
  songsByRound: Map<string, DatabaseSong[]>,
  audienceVotesByRound: Map<string, number>,
): RoundCandidate[] {
  const sourceLabels = sourceSongLabels(source);
  return rounds.map((round) => {
    const songScore = matchedSourceSongs(source, songsByRound.get(round.id) || []);
    return {
      round,
      dateScore: roundMatchScore(round, source.votingDate),
      songScore,
      songRatio: sourceLabels.length ? songScore / sourceLabels.length : 0,
      audienceVotes: audienceVotesByRound.get(round.id) || 0,
      unsuitable: /(^|\W)(test|dj)(\W|$)/i.test(`${round.title} ${round.slug}`),
    };
  })
    .filter((entry) => entry.dateScore > 0 || (entry.songScore >= 7 && entry.songRatio >= 0.55))
    .sort((a, b) => Number(a.unsuitable) - Number(b.unsuitable)
      || Number(b.dateScore > 0) - Number(a.dateScore > 0)
      || b.songScore - a.songScore
      || b.songRatio - a.songRatio
      || b.audienceVotes - a.audienceVotes
      || b.dateScore - a.dateScore
      || a.round.title.localeCompare(b.round.title, 'de'));
}

function matchRound(
  rounds: DatabaseRound[],
  source: ManifestRound,
  songsByRound: Map<string, DatabaseSong[]>,
  audienceVotesByRound: Map<string, number>,
) {
  const candidates = rankRoundCandidates(rounds, source, songsByRound, audienceVotesByRound);
  if (!candidates.length) return null;
  if (candidates[0].dateScore === 0) {
    const second = candidates[1];
    if (candidates[0].songScore < 10 || candidates[0].songRatio < 0.7
      || (second && candidates[0].songScore - second.songScore < 3)) return null;
  }
  if (candidates[1]
    && candidates[0].unsuitable === candidates[1].unsuitable
    && candidates[0].songScore === candidates[1].songScore
    && candidates[0].audienceVotes === candidates[1].audienceVotes
    && candidates[0].dateScore === candidates[1].dateScore) return null;
  return candidates[0].round;
}

function roundSuggestion(
  rounds: DatabaseRound[],
  source: ManifestRound,
  songsByRound: Map<string, DatabaseSong[]>,
  audienceVotesByRound: Map<string, number>,
) {
  const best = rankRoundCandidates(rounds, source, songsByRound, audienceVotesByRound)[0];
  if (!best || best.unsuitable) return null;
  const confidence = Math.min(99, 55 + best.dateScore * 2 + Math.min(20, best.songScore));
  return { ...best, confidence };
}

function skippedColumnKind(column: ManifestSkippedColumn): HistoricalSkippedColumnReport['kind'] {
  if (column.rankingCount === 0) return 'empty';
  if (column.category === 'dj' && canonicalJurorKey(column.displayName || column.sourceName) === 'djgesamtwertung') return 'dj-aggregate';
  return 'ranking-error';
}

function ignoredReasonKey(sheet: string, sourceName: string) {
  return `${sheet}::${sourceName}`;
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

function tokenSimilarity(left: string, right: string) {
  const tokens = (value: string) => new Set(value
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('de-DE')
    .replace(/ß/g, 'ss').split(/[^a-z0-9]+/).filter((token) => token.length >= 2));
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return (2 * intersection) / (a.size + b.size);
}

function songSimilarity(left: string, right: string) {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  const containment = normalizedLeft && normalizedRight
    ? Math.min(normalizedLeft.length, normalizedRight.length) / Math.max(normalizedLeft.length, normalizedRight.length)
      * Number(normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))
    : 0;
  return Math.max(similarity(normalizedLeft, normalizedRight), tokenSimilarity(left, right), containment);
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
  strategy: 'exact' | 'ellipsis' | 'reversed' | 'fuzzy' | 'manual' | 'ignored' | 'missing';
  confidence: number;
  suggestions: Array<{ id: string | null; label: string; confidence: number | null }>;
};

function matchSong(sourceLabel: string, songs: DatabaseSong[], manualSongId?: string): SongMatch {
  if (manualSongId) {
    if (manualSongId === HISTORICAL_MAPPING_IGNORE) {
      return { song: null, strategy: 'ignored', confidence: 1, suggestions: [{ id: null, label: 'Dieser Excel-Eintrag wurde bewusst auf „Nicht übernehmen“ gesetzt.', confidence: null }] };
    }
    const manual = songs.find((song) => song.id === manualSongId) || null;
    return manual
      ? { song: manual, strategy: 'manual', confidence: 1, suggestions: [] }
      : { song: null, strategy: 'missing', confidence: 0, suggestions: [{ id: null, label: 'Gespeicherte Zuordnung gehört nicht mehr zu dieser Umfrage.', confidence: null }] };
  }
  const source = normalize(sourceLabel);
  const rows = songs.map((song) => {
    const forward = normalize(`${song.title} - ${song.artist}`);
    const reversed = normalize(`${song.artist} - ${song.title}`);
    return {
      song,
      forward,
      reversed,
      score: Math.max(
        songSimilarity(sourceLabel, `${song.title} - ${song.artist}`),
        songSimilarity(sourceLabel, `${song.artist} - ${song.title}`),
        songSimilarity(sourceLabel, song.title),
      ),
    };
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
  if (best && best.score >= 0.72 && (!second || best.score - second.score >= 0.05)) {
    return { song: best.song, strategy: 'fuzzy', confidence: best.score, suggestions: [] };
  }
  return {
    song: null, strategy: 'missing', confidence: best?.score || 0,
    suggestions: sorted.slice(0, 3).filter((entry) => entry.score >= 0.32).map((entry) => ({
      id: entry.song.id,
      label: `${entry.song.title} – ${entry.song.artist}`,
      confidence: Math.round(entry.score * 100),
    })),
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

async function fetchAudienceVoteCounts(roundIds: string[]) {
  const sb = getSupabaseAdminClient();
  const counts = new Map<string, number>();
  if (!sb) return counts;
  for (const ids of chunks(roundIds, 10)) {
    const results = await Promise.all(ids.map(async (roundId) => {
      const { count, error } = await sb
        .from('release_voting_votes')
        .select('id', { count: 'exact', head: true })
        .eq('round_id', roundId)
        .eq('voting_channel', 'audience');
      if (error) throw error;
      return { roundId, count: count || 0 };
    }));
    for (const result of results) counts.set(result.roundId, result.count);
  }
  return counts;
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
  reason?: string;
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
    const reasonKey = ignoredReasonKey(input.sheet, sourceName);
    if (input.value === HISTORICAL_MAPPING_IGNORE) overrides.ignoredReasons[reasonKey] = String(input.reason || '').trim();
    else delete overrides.ignoredReasons[reasonKey];
  } else {
    const sourceName = String(input.sourceName || '').trim();
    const skipped = sourceRound.skippedColumns.find((column) => column.sourceName === sourceName);
    if (!skipped || !skipped.rankingCount) throw new Error('Für diese Spalte gibt es keine korrigierbare Rangliste.');
    if (skippedColumnKind(skipped) === 'dj-aggregate') {
      throw new Error('Diese DJ-Gesamtwertung ist eine aggregierte Auswertung mit möglichen Dezimalwerten und darf nicht in eine einzelne 12-bis-1-Stimme umgeschrieben werden.');
    }
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

function splitHistoricalSongLabel(label: string) {
  const matches = [...label.matchAll(/\s(?:–|—|-)\s/g)];
  const separator = matches[matches.length - 1];
  if (!separator || separator.index == null) return { title: label.trim(), artist: '' };
  const start = separator.index;
  const end = start + separator[0].length;
  return {
    title: label.slice(0, start).trim(),
    artist: label.slice(end).trim(),
  };
}

function historicalRoundDates(votingDate: string) {
  const starts = new Date(`${votingDate}T00:00:00.000Z`);
  starts.setUTCDate(starts.getUTCDate() - 7);
  return {
    startsAt: starts.toISOString(),
    endsAt: `${votingDate}T23:59:59.000Z`,
  };
}

async function uniqueHistoricalSlug(base: string) {
  const sb = getSupabaseAdminClient();
  if (!sb) throw new Error('Supabase ist nicht konfiguriert.');
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix ? `${base}-${suffix + 1}` : base;
    const { data, error } = await sb.from('release_voting_rounds').select('id').eq('slug', candidate).maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  throw new Error('Für die historische Umfrage konnte kein eindeutiger Slug erzeugt werden.');
}

export async function createHistoricalRoundFromManifest(sheet: string) {
  const sourceRound = manifest.rounds.find((round) => round.sheet === sheet);
  if (!sourceRound) throw new Error('Diese Excel-Woche ist unbekannt.');
  const catalog = sourceSongCatalog(sourceRound);
  if (catalog.length !== sourceRound.songsInSheet) {
    throw new Error(`Die Excel-Songliste ist nicht vollständig verfügbar (${catalog.length}/${sourceRound.songsInSheet}). Die Runde wird deshalb nicht automatisch angelegt.`);
  }
  const normalizedLabels = catalog.map(normalize);
  if (normalizedLabels.some((label) => !label) || new Set(normalizedLabels).size !== catalog.length) {
    throw new Error('Die Excel-Songliste enthält leere oder doppelte Einträge. Die Runde wird nicht automatisch angelegt.');
  }

  const sb = getSupabaseAdminClient();
  if (!sb) throw new Error('Supabase ist nicht konfiguriert.');
  const databaseRounds = await fetchAllRounds();
  const roundIds = databaseRounds.map((round) => round.id);
  const [songs, audienceVotesByRound] = await Promise.all([
    fetchRoundScopedRows<DatabaseSong>('release_voting_songs', 'id,round_id,title,artist,sort_order', roundIds),
    fetchAudienceVoteCounts(roundIds),
  ]);
  const songsByRound = new Map<string, DatabaseSong[]>();
  for (const song of songs) songsByRound.set(song.round_id, [...(songsByRound.get(song.round_id) || []), song]);
  const existingCandidate = rankRoundCandidates(databaseRounds, sourceRound, songsByRound, audienceVotesByRound)
    .find((candidate) => !candidate.unsuitable && (candidate.dateScore > 0 || (candidate.songScore >= 7 && candidate.songRatio >= 0.55)));
  if (existingCandidate) {
    throw new Error(`Für diese Woche existiert wahrscheinlich bereits „${existingCandidate.round.title}“. Bitte diese Umfrage zuordnen, statt eine zweite anzulegen.`);
  }

  const title = `Neue Songs der Woche ${germanDate(sourceRound.votingDate)}`;
  const slug = await uniqueHistoricalSlug(normalizeSlug(`${title}-historisch`));
  const dates = historicalRoundDates(sourceRound.votingDate);
  const { data: createdRound, error: roundError } = await sb.from('release_voting_rounds').insert({
    title,
    slug,
    description: `Historische Umfrage aus ${roundSupplements.sourceFile} ergänzt.`,
    status: 'ended',
    starts_at: dates.startsAt,
    ends_at: dates.endsAt,
    places_count: 12,
    is_current: false,
    is_public_results: false,
  }).select('id').single();
  if (roundError) throw roundError;
  if (!createdRound?.id) throw new Error('Die historische Umfrage wurde nicht vollständig angelegt.');

  try {
    const rows = catalog.map((label, sortOrder) => ({
      round_id: createdRound.id,
      ...splitHistoricalSongLabel(label),
      sort_order: sortOrder,
    }));
    for (const batch of chunks(rows, 200)) {
      const { error } = await sb.from('release_voting_songs').insert(batch);
      if (error) throw error;
    }
  } catch (error) {
    await sb.from('release_voting_rounds').delete().eq('id', createdRound.id);
    throw error;
  }

  const overrides = await loadOverrides();
  overrides.roundMappings[sourceRound.sheet] = createdRound.id;
  await setSetting(OVERRIDES_SETTING_KEY, JSON.stringify(overrides));
  return buildHistoricalJuryImportPlan();
}

export async function createHistoricalSongFromManifest(sheet: string, sourceSong: string) {
  const sourceRound = manifest.rounds.find((round) => round.sheet === sheet);
  if (!sourceRound || !sourceSongCatalog(sourceRound).includes(sourceSong)) {
    throw new Error('Dieser Excel-Song wurde in der historischen Woche nicht gefunden.');
  }
  const plan = await buildHistoricalJuryImportPlan();
  const reportRound = plan.report.rounds.find((round) => round.sheet === sheet);
  if (!reportRound?.targetRound) throw new Error('Bitte zuerst die historische Woche einer Umfrage zuordnen.');

  const sb = getSupabaseAdminClient();
  if (!sb) throw new Error('Supabase ist nicht konfiguriert.');
  const { data: roundSongsData, error: songsError } = await sb.from('release_voting_songs')
    .select('id,round_id,title,artist,sort_order').eq('round_id', reportRound.targetRound.id).order('sort_order');
  if (songsError) throw songsError;
  const roundSongs = (roundSongsData || []) as DatabaseSong[];
  const existing = matchSong(sourceSong, roundSongs);
  if (existing.song) {
    throw new Error(`Der Song passt bereits zu „${existing.song.title} – ${existing.song.artist}“. Bitte den vorhandenen Vorschlag bestätigen.`);
  }
  const song = splitHistoricalSongLabel(sourceSong);
  const nextSortOrder = roundSongs.reduce((maximum, row) => Math.max(maximum, Number(row.sort_order || 0)), -1) + 1;
  const { data: createdSong, error: createError } = await sb.from('release_voting_songs').insert({
    round_id: reportRound.targetRound.id,
    title: song.title,
    artist: song.artist,
    sort_order: nextSortOrder,
  }).select('id').single();
  if (createError) throw createError;
  if (!createdSong?.id) throw new Error('Der historische Song wurde nicht vollständig angelegt.');

  const overrides = await loadOverrides();
  overrides.songMappings[sourceRound.sheet] ||= {};
  overrides.songMappings[sourceRound.sheet][sourceSong] = createdSong.id;
  await setSetting(OVERRIDES_SETTING_KEY, JSON.stringify(overrides));
  return buildHistoricalJuryImportPlan();
}

export async function buildHistoricalJuryImportPlan(): Promise<ImportPlan> {
  if (manifest.schemaVersion !== 2) throw new Error('Unbekannte Version der historischen Jury-Importdatei.');
  const sb = getSupabaseAdminClient();
  if (!sb) throw new Error('Supabase ist nicht konfiguriert.');
  const [databaseRounds, overrides] = await Promise.all([fetchAllRounds(), loadOverrides()]);
  const databaseRoundIds = databaseRounds.map((round) => round.id);
  const [songs, audienceVotesByRound] = await Promise.all([
    fetchRoundScopedRows<DatabaseSong>('release_voting_songs', 'id,round_id,title,artist,sort_order', databaseRoundIds),
    fetchAudienceVoteCounts(databaseRoundIds),
  ]);
  const allSongsByRound = new Map<string, DatabaseSong[]>();
  for (const song of songs) allSongsByRound.set(song.round_id, [...(allSongsByRound.get(song.round_id) || []), song]);
  const roundMatches = new Map(manifest.rounds.map((source) => {
    const manualId = overrides.roundMappings[source.sheet];
    return [source.sheet, manualId
      ? databaseRounds.find((round) => round.id === manualId) || null
      : matchRound(databaseRounds, source, allSongsByRound, audienceVotesByRound)] as const;
  }));
  const roundSuggestions = new Map(manifest.rounds.map((source) => [
    source.sheet,
    roundSuggestion(databaseRounds, source, allSongsByRound, audienceVotesByRound),
  ] as const));
  const roundIds = [...new Set([...roundMatches.values()].filter((round): round is DatabaseRound => Boolean(round)).map((round) => round.id))];
  const [jurors, votes, profileResult] = await Promise.all([
    fetchRoundScopedRows<DatabaseJuror>('release_voting_round_jurors', 'id,round_id,profile_id,display_name,voting_role,is_active', roundIds),
    fetchRoundScopedRows<DatabaseVote>('release_voting_jury_votes', 'id,round_id,round_juror_id,submitted_at', roundIds),
    sb.from('release_voting_jury_profiles').select('id,name'),
  ]);
  if (profileResult.error) throw profileResult.error;
  const profiles = (profileResult.data || []) as DatabaseProfile[];
  const voteItems = await fetchVoteItems(votes.map((vote) => vote.id));

  const songsByRound = allSongsByRound;
  const jurorsByRound = new Map<string, DatabaseJuror[]>();
  const voteByJuror = new Map(votes.map((vote) => [vote.round_juror_id, vote]));
  const itemsByVote = new Map<string, DatabaseVoteItem[]>();
  for (const juror of jurors) jurorsByRound.set(juror.round_id, [...(jurorsByRound.get(juror.round_id) || []), juror]);
  for (const item of voteItems) itemsByVote.set(item.vote_id, [...(itemsByVote.get(item.vote_id) || []), item]);
  const profilesByKey = new Map(profiles.map((profile) => [canonicalJurorKey(profile.name), profile]));

  const prepared: PreparedJuror[] = [];
  const roundReports: HistoricalJuryRoundReport[] = [];
  for (const sourceRound of manifest.rounds) {
    const targetRound = roundMatches.get(sourceRound.sheet) || null;
    const corrections = overrides.rankingCorrections[sourceRound.sheet] || {};
    const sourceJurors: ManifestJuror[] = [
      ...sourceRound.jurors.map((juror) => ({
        ...juror,
        displayName: historicalJurorDisplayName(juror.sourceName, juror.displayName),
      })),
      ...sourceRound.skippedColumns.filter((column) => skippedColumnKind(column) === 'ranking-error' && Boolean(corrections[column.sourceName])).map((column) => ({
        sourceName: column.sourceName,
        displayName: historicalJurorDisplayName(column.sourceName, column.displayName),
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
      const ignoredReason = overrides.ignoredReasons[ignoredReasonKey(sourceRound.sheet, sourceJuror.sourceName)] || '';
      if (jurorMappingValue === HISTORICAL_MAPPING_IGNORE) {
        jurorReports.push({ sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category,
          status: 'ignored', message: 'Diese Wertung wurde bewusst vom Import ausgeschlossen.', matchedSongs: 0,
          matchReviews: [], missingSongs: [], jurorMappingValue, suggestedJuror: null, ignoredReason });
        continue;
      }
      if (!targetRound) {
        jurorReports.push({ sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category,
          status: 'blocked', message: `Keine eindeutige Umfrage für den ${germanDate(sourceRound.votingDate)} gefunden.`,
          matchedSongs: 0, matchReviews: [], missingSongs: [], jurorMappingValue, suggestedJuror: null, ignoredReason });
        continue;
      }

      const matchReviews: HistoricalJuryMatchReview[] = [];
      const missingSongs: HistoricalJuryJurorReport['missingSongs'] = [];
      const items: Array<{ song_id: string; points: number }> = [];
      for (const item of sourceJuror.ranking.filter((entry) => Number(entry.points) > 0)) {
        const match = songMatches.get(item.songLabel);
        const collision = match?.song ? (collisions.get(match.song.id)?.length || 0) > 1 : false;
        const needsConfirmation = Boolean(match?.song)
          && match?.strategy !== 'exact'
          && match?.strategy !== 'manual';
        if (!match?.song || collision || needsConfirmation) {
          missingSongs.push({ sourceSong: item.songLabel,
            suggestions: collision
              ? [{ id: null, label: 'Mehrere Excel-Zeilen würden demselben Datenbank-Song zugeordnet.', confidence: null }]
              : needsConfirmation && match?.song
                ? [{ id: match.song.id, label: `${match.song.title} – ${match.song.artist}`, confidence: Math.round(match.confidence * 100) }]
                : (match?.suggestions || []),
            mappingValue: overrides.songMappings[sourceRound.sheet]?.[item.songLabel] || '' });
          continue;
        }
        items.push({ song_id: match.song.id, points: Number(item.points) });
        if (match.strategy === 'manual') {
          matchReviews.push({ sourceSong: item.songLabel, matchedSong: `${match.song.title} – ${match.song.artist}`,
            strategy: match.strategy, confidence: Math.round(match.confidence * 100) });
        }
      }

      const key = canonicalJurorKey(sourceJuror.displayName);
      const sameRoleJurors = roundJurors.filter((juror) => (juror.voting_role || 'jury') === sourceJuror.category);
      const automaticMatches = sameRoleJurors.filter((juror) => canonicalJurorKey(juror.display_name) === key);
      const rankedJurorSuggestions = sameRoleJurors
        .map((juror) => ({ juror, score: similarity(key, canonicalJurorKey(juror.display_name)) }))
        .sort((a, b) => b.score - a.score);
      const bestJurorSuggestion = rankedJurorSuggestions[0]
        && rankedJurorSuggestions[0].score >= 0.75
        && (!rankedJurorSuggestions[1] || rankedJurorSuggestions[0].score - rankedJurorSuggestions[1].score >= 0.1)
        ? { id: rankedJurorSuggestions[0].juror.id, displayName: rankedJurorSuggestions[0].juror.display_name, confidence: Math.round(rankedJurorSuggestions[0].score * 100) }
        : null;
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
          matchedSongs: items.length, matchReviews, missingSongs, jurorMappingValue, suggestedJuror: null, ignoredReason };
      } else if (invalidManualJuror) {
        report = { sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category, status: 'conflict',
          message: 'Die gespeicherte Zuordnung gehört nicht mehr zu dieser Umfrage oder Kategorie.',
          matchedSongs: 12, matchReviews, missingSongs: [], jurorMappingValue, suggestedJuror: null, ignoredReason };
      } else if (jurorMappingValue === HISTORICAL_MAPPING_AUTO && automaticMatches.length > 1) {
        report = { sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category, status: 'conflict',
          message: 'Mehrere vorhandene Zuordnungen passen zu diesem Namen.', matchedSongs: 12, matchReviews, missingSongs: [], jurorMappingValue,
          suggestedJuror: null, ignoredReason };
      } else if (jurorMappingValue === HISTORICAL_MAPPING_AUTO && automaticMatches.length === 0 && bestJurorSuggestion) {
        report = { sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category, status: 'blocked',
          message: 'Der Jurorname ist ähnlich, aber nicht identisch. Bitte den Vorschlag einmal bestätigen.', matchedSongs: 12, matchReviews, missingSongs: [], jurorMappingValue,
          suggestedJuror: bestJurorSuggestion, ignoredReason };
      } else if (existingVote) {
        const identical = itemsEqual(itemsByVote.get(existingVote.id) || [], items);
        report = { sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category,
          status: identical ? 'already-imported' : 'conflict',
          message: identical ? 'Diese Wertung ist bereits identisch vorhanden.' : 'Es existiert bereits eine abweichende oder unvollständige Wertung; sie wird nicht überschrieben.',
          matchedSongs: 12, matchReviews, missingSongs: [], jurorMappingValue, suggestedJuror: null, ignoredReason };
      } else {
        report = { sourceName: sourceJuror.sourceName, displayName: sourceJuror.displayName, category: sourceJuror.category,
          status: existingJuror ? 'ready-existing' : 'ready-new',
          message: existingJuror ? 'Vorhandene Zuordnung ohne Wertung wird ergänzt.' : `${sourceJuror.category === 'dj' ? 'DJ-Kategorie' : 'Juror'} und Wertung können neu angelegt werden.`,
          matchedSongs: 12, matchReviews, missingSongs: [], jurorMappingValue, suggestedJuror: null, ignoredReason };
      }
      jurorReports.push(report);
      prepared.push({ sourceRound, targetRound, sourceJuror, report,
        profileId: sourceJuror.category === 'jury' ? profilesByKey.get(key)?.id || null : null,
        existingJuror, existingVote, items });
    }

    const skippedColumns: HistoricalSkippedColumnReport[] = sourceRound.skippedColumns.map((column) => ({
      ...column,
      displayName: historicalJurorDisplayName(column.sourceName, column.displayName),
      kind: skippedColumnKind(column),
      corrected: skippedColumnKind(column) === 'ranking-error' && Boolean(corrections[column.sourceName]),
      ignored: overrides.jurorMappings[sourceRound.sheet]?.[column.sourceName] === HISTORICAL_MAPPING_IGNORE,
      ignoredReason: overrides.ignoredReasons[ignoredReasonKey(sourceRound.sheet, column.sourceName)] || '',
      currentRanking: corrections[column.sourceName] || column.ranking,
    }));
    const ready = jurorReports.filter((juror) => juror.status === 'ready-new' || juror.status === 'ready-existing').length;
    const actionable = jurorReports.filter((juror) => juror.status !== 'ignored');
    const openSourceErrors = skippedColumns.filter((column) => column.kind === 'ranking-error' && !column.corrected && !column.ignored);
    const complete = actionable.length > 0 && actionable.every((juror) => juror.status === 'already-imported') && openSourceErrors.length === 0;
    const blocked = actionable.filter((juror) => juror.status === 'blocked' || juror.status === 'conflict').length
      + openSourceErrors.length;
    const suggested = roundSuggestions.get(sourceRound.sheet);
    roundReports.push({
      sheet: sourceRound.sheet, votingDate: sourceRound.votingDate, sourceSongs: sourceRound.songsInSheet,
      targetRound: targetRound ? {
        id: targetRound.id,
        title: targetRound.title,
        slug: targetRound.slug,
        songsCount: roundSongs.length,
        audienceVotes: audienceVotesByRound.get(targetRound.id) || 0,
      } : null,
      suggestedRound: !targetRound && suggested ? {
        id: suggested.round.id,
        title: suggested.round.title,
        slug: suggested.round.slug,
        songsCount: (allSongsByRound.get(suggested.round.id) || []).length,
        audienceVotes: suggested.audienceVotes,
        confidence: suggested.confidence,
      } : null,
      roundMappingValue: overrides.roundMappings[sourceRound.sheet] || '',
      status: complete ? 'complete' : ready > 0 && blocked > 0 ? 'partial' : ready > 0 ? 'ready' : blocked > 0 ? 'blocked' : 'complete',
      jurors: jurorReports, skippedColumns, zonkEntries: sourceRound.zonkEntries,
      songOptions: [...roundSongs].sort((a, b) => a.sort_order - b.sort_order).map((song) => ({ id: song.id, label: `${song.title} – ${song.artist}` })),
      jurorOptions: [...roundJurors].sort((a, b) => a.display_name.localeCompare(b.display_name, 'de'))
        .map((juror) => ({ id: juror.id, displayName: juror.display_name, category: juror.voting_role || 'jury' })),
      canCreateRound: !targetRound && sourceSongCatalog(sourceRound).length === sourceRound.songsInSheet,
      sourceSongCatalogCount: sourceSongCatalog(sourceRound).length,
    });
  }

  const allJurors = roundReports.flatMap((round) => round.jurors);
  const allSkipped = roundReports.flatMap((round) => round.skippedColumns);
  const valid = allJurors.filter((juror) => juror.status !== 'ignored');
  const ready = valid.filter((juror) => juror.status === 'ready-new' || juror.status === 'ready-existing');
  const reviewVotes = valid.filter((juror) => juror.status === 'blocked').length;
  const rankingErrors = allSkipped.filter((column) => column.kind === 'ranking-error' && !column.corrected && !column.ignored);
  const conflictingVotes = valid.filter((juror) => juror.status === 'conflict').length;
  const errorVotes = conflictingVotes + rankingErrors.length;
  const aggregateDjColumns = allSkipped.filter((column) => column.kind === 'dj-aggregate').length;
  const foundVotes = manifest.rounds.reduce((sum, round) => sum + round.jurors.length + round.skippedColumns.filter((column) => column.rankingCount > 0).length, 0);
  return {
    prepared,
    report: {
      sourceFile: manifest.sourceFile,
      generatedAt: new Date().toISOString(),
      roundOptions: [...databaseRounds].sort((a, b) => String(b.ends_at || b.created_at).localeCompare(String(a.ends_at || a.created_at)))
        .map((round) => ({
          id: round.id,
          title: round.title,
          slug: round.slug,
          period: round.ends_at?.slice(0, 10) || round.starts_at?.slice(0, 10) || round.created_at.slice(0, 10),
          songsCount: (allSongsByRound.get(round.id) || []).length,
          audienceVotes: audienceVotesByRound.get(round.id) || 0,
        })),
      summary: {
        foundVotes,
        safeVotes: ready.length,
        reviewVotes,
        errorVotes,
        openProblems: reviewVotes + errorVotes,
        sourceRounds: manifest.rounds.length,
        matchedRounds: roundReports.filter((round) => Boolean(round.targetRound)).length,
        validSourceVotes: valid.length,
        validJuryVotes: valid.filter((juror) => juror.category === 'jury').length,
        validDjVotes: valid.filter((juror) => juror.category === 'dj').length,
        readyVotes: ready.length,
        readyJuryVotes: ready.filter((juror) => juror.category === 'jury').length,
        readyDjVotes: ready.filter((juror) => juror.category === 'dj').length,
        alreadyImportedVotes: valid.filter((juror) => juror.status === 'already-imported').length,
        blockedVotes: reviewVotes,
        conflictingVotes,
        ignoredVotes: allJurors.filter((juror) => juror.status === 'ignored').length + allSkipped.filter((column) => column.ignored && !column.corrected).length,
        skippedSourceColumns: allSkipped.filter((column) => column.kind !== 'dj-aggregate' && !column.corrected && !column.ignored).length,
        invalidSourceVotes: rankingErrors.length,
        emptySourceColumns: allSkipped.filter((column) => column.rankingCount === 0 && !column.ignored).length,
        zonkEntriesNotImported: manifest.rounds.reduce((sum, round) => sum + round.zonkEntries, 0),
        reviewedSongMatches: valid.reduce((sum, juror) => sum + juror.matchReviews.length, 0),
        aggregateDjColumns,
      },
      rounds: roundReports,
    },
  };
}

function importedTimestamp(round: DatabaseRound, source: ManifestRound) {
  return round.ends_at || `${source.votingDate}T20:00:00.000Z`;
}

async function performHistoricalJuryImport(only?: { sheet: string; sourceName: string }) {
  const sb = getSupabaseAdminClient();
  if (!sb) throw new Error('Supabase ist nicht konfiguriert.');
  const plan = await buildHistoricalJuryImportPlan();
  const scoped = plan.prepared.filter((entry) => !only || (entry.sourceRound.sheet === only.sheet && entry.sourceJuror.sourceName === only.sourceName));
  const ready = scoped.filter((entry) => entry.report.status === 'ready-new' || entry.report.status === 'ready-existing');
  const now = new Date().toISOString();
  const activateIds = [...new Set(scoped
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

export async function importHistoricalJuryVotes() {
  return performHistoricalJuryImport();
}

export async function importSingleHistoricalJuryVote(sheet: string, sourceName: string) {
  const result = await performHistoricalJuryImport({ sheet, sourceName });
  if (result.importedVotes === 0) {
    const round = result.report.rounds.find((entry) => entry.sheet === sheet);
    const juror = round?.jurors.find((entry) => entry.sourceName === sourceName);
    if (juror?.status === 'already-imported') return result;
    throw new Error(juror?.message || 'Diese Wertung ist noch nicht vollständig und kann noch nicht importiert werden.');
  }
  return result;
}

export type HistoricalDjAggregate = {
  sheet: string;
  votingDate: string;
  displayName: string;
  rows: Array<{
    rank: number;
    sourceSong: string;
    songId: string | null;
    title: string;
    artist: string;
    score: number;
    matched: boolean;
  }>;
  unmatchedSongs: number;
};

function splitSourceSong(label: string) {
  const separator = label.indexOf(' - ');
  if (separator < 0) return { title: label, artist: '' };
  return { title: label.slice(0, separator), artist: label.slice(separator + 3) };
}

/**
 * Liest zusammengefasste historische DJ-Spalten unverändert aus dem Importmanifest.
 * Diese Werte dürfen Dezimalstellen und Gleichstände enthalten und werden deshalb
 * bewusst nicht in release_voting_jury_vote_items (Ganzzahl 1–12) geschrieben.
 */
export async function getHistoricalDjAggregatesForRound(round: Round, songs: Song[]): Promise<HistoricalDjAggregate[]> {
  const overrides = await loadOverrides();
  const databaseSongs: DatabaseSong[] = songs.map((song) => ({ ...song }));
  const aggregates: HistoricalDjAggregate[] = [];

  for (const sourceRound of manifest.rounds) {
    const columns = sourceRound.skippedColumns.filter((column) => skippedColumnKind(column) === 'dj-aggregate');
    if (!columns.length) continue;
    const manualRound = overrides.roundMappings[sourceRound.sheet];
    const automaticDateMatch = !manualRound && roundMatchScore(round as DatabaseRound, sourceRound.votingDate) > 0;
    const songOverlap = matchedSourceSongs(sourceRound, databaseSongs);
    if (manualRound ? manualRound !== round.id : !automaticDateMatch || songOverlap < Math.min(6, columns[0].rankingCount)) continue;

    for (const column of columns) {
      const mappedRows = column.ranking.map((item) => {
        const manualSong = overrides.songMappings[sourceRound.sheet]?.[item.songLabel];
        const match = matchSong(item.songLabel, databaseSongs, manualSong);
        const fallback = splitSourceSong(item.songLabel);
        return {
          sourceSong: item.songLabel,
          songId: match.song?.id || null,
          title: match.song?.title || fallback.title,
          artist: match.song?.artist || fallback.artist,
          score: Number(item.points),
          matched: Boolean(match.song),
        };
      }).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'de'));
      let previousScore: number | null = null;
      let previousRank = 0;
      const rows = mappedRows.map((row, index) => {
        const rank = previousScore != null && row.score === previousScore ? previousRank : index + 1;
        previousScore = row.score;
        previousRank = rank;
        return { ...row, rank };
      });
      aggregates.push({
        sheet: sourceRound.sheet,
        votingDate: sourceRound.votingDate,
        displayName: column.displayName,
        rows,
        unmatchedSongs: rows.filter((row) => !row.matched).length,
      });
    }
  }
  return aggregates;
}
