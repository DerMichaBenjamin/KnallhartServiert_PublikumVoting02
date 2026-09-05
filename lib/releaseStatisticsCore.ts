import type { AdminJuryRoundData } from './juryVoting';
import { buildCombinedResults, compareResultSongs, type CombinedResultRow } from './combinedVotingResults';
import { isSongActive, splitSongLine, type AdminRoundSummary, type AudienceRatingStats, type Round, type Song } from './releaseVotingShared';

export type StatisticTone = 'neutral' | 'success' | 'warning' | 'danger' | 'violet';

export type StatisticHighlight = {
  key: string;
  title: string;
  value: string;
  detail: string;
  tone: StatisticTone;
  songId?: string;
};

export type SongDetailStatistics = {
  ratingCount: number;
  averageRating: number | null;
  highestRating: number | null;
  lowestRating: number | null;
  topRatings: number;
  zeroRatings: number;
  standardDeviation: number | null;
  distribution: number[];
};

export type RankingComparisonRow = {
  song: Song;
  overallRank: number | null;
  audienceRank: number | null;
  juryRank: number | null;
  audienceRawPoints: number;
  audienceMentions: number;
  audiencePoints: number;
  juryPoints: number;
  juryAverage: number | null;
  total: number;
  audienceAverage: number | null;
  rankDifference: number | null;
  polarizationIndex: number | null;
  polarizationLabel: string;
  ratingVoices: number;
  detail: SongDetailStatistics;
};

export type WeekComparisonMetric = {
  key: 'participants' | 'polarization' | 'winnerGap' | 'top3Share' | 'top5Share';
  label: string;
  current: number | null;
  average: number | null;
  delta: number | null;
  unit: 'number' | 'points' | 'percent';
};

export type ReleaseWeekStatistics = {
  round: Round;
  songsCount: number;
  totalVotes: number;
  countedVotes: number;
  confirmedVotes: number;
  reviewVotes: number;
  excludedVotes: number;
  unverifiedVotes: number;
  activeJurors: number;
  submittedJurors: number;
  individualRatings: number;
  winnerGap: number | null;
  winnerGapPercent: number | null;
  top3Share: number | null;
  top5Share: number | null;
  songsWithoutPoints: number;
  songsWithoutRatings: number;
  averagePolarization: number | null;
  comparisonRows: RankingComparisonRow[];
  overallRows: CombinedResultRow[];
  highlights: StatisticHighlight[];
  zonk: Array<{ song: Song; count: number }>;
  hasActivity: boolean;
};

export type ArtistHistoryEntry = {
  roundId: string;
  roundTitle: string;
  date: string;
  songId: string;
  songTitle: string;
  overallRank: number | null;
  audienceRank: number | null;
  juryRank: number | null;
  overallPoints: number;
  audiencePoints: number;
  juryPoints: number;
};

export type ArtistHistory = {
  key: string;
  name: string;
  participations: number;
  averageRank: number | null;
  bestRank: number | null;
  worstRank: number | null;
  wins: number;
  top3: number;
  top5: number;
  averageAudienceRank: number | null;
  averageJuryRank: number | null;
  lastParticipation: string | null;
  entries: ArtistHistoryEntry[];
};

export type ReportGraphicData = {
  roundId: string;
  title: string;
  period: string;
  songsCount: number;
  totalVotes: number;
  countedVotes: number;
  individualRatings: number;
  juryStatus: string;
  winner: string;
  winnerPoints: number | null;
  winnerGap: number | null;
  winnerGapPercent: number | null;
  top3Share: number | null;
  top5Share: number | null;
  averagePolarization: number | null;
  songsWithoutPoints: number;
  songsWithoutRatings: number;
  highlights: StatisticHighlight[];
  results: Array<{
    rank: number | null;
    title: string;
    artist: string;
    audiencePoints: number;
    juryPoints: number;
    total: number;
  }>;
};

function roundDate(round: Round) {
  return round.starts_at || round.ends_at || round.created_at;
}

function finiteMean(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function percent(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : null;
}

function buildSongDetailStatistics(audience: AudienceRatingStats | undefined, juryScores: number[]): SongDetailStatistics {
  const distribution = Array.from({ length: 13 }, (_, points) => audience?.distribution[points] || 0);
  for (const rawScore of juryScores) {
    const score = Math.min(12, Math.max(0, Number(rawScore) || 0));
    distribution[score] += 1;
  }
  const ratingCount = distribution.reduce((sum, count) => sum + count, 0);
  const sum = distribution.reduce((total, count, points) => total + count * points, 0);
  const sumSquares = distribution.reduce((total, count, points) => total + count * (points ** 2), 0);
  const averageRating = ratingCount ? sum / ratingCount : null;
  const variance = ratingCount && averageRating !== null ? Math.max(0, (sumSquares / ratingCount) - (averageRating ** 2)) : null;
  const lowestPositive = distribution.findIndex((count, points) => points > 0 && count > 0);
  let highestRating: number | null = null;
  for (let points = distribution.length - 1; points >= 1; points -= 1) {
    if (distribution[points] > 0) { highestRating = points; break; }
  }
  return {
    ratingCount,
    averageRating,
    highestRating,
    lowestRating: lowestPositive >= 1 ? lowestPositive : null,
    topRatings: distribution[12] || 0,
    zeroRatings: distribution[0] || 0,
    standardDeviation: variance === null ? null : Math.sqrt(variance),
    distribution,
  };
}

function competitionRanks<T>(rows: T[], score: (row: T) => number, hasVotes: boolean) {
  const sorted = [...rows].sort((a, b) => score(b) - score(a));
  const result = new Map<T, number | null>();
  let previousScore: number | null = null;
  let previousRank = 0;
  sorted.forEach((row, index) => {
    if (!hasVotes) {
      result.set(row, null);
      return;
    }
    const value = score(row);
    const rank = previousScore === value ? previousRank : index + 1;
    result.set(row, rank);
    previousScore = value;
    previousRank = rank;
  });
  return result;
}

/**
 * Reproduzierbarer Polarisierungsindex auf der gemeinsamen 0-bis-12-Skala.
 * Jede abgeschlossene Jury-Wertung ist eine Stimme; das Publikum ist entsprechend
 * der bestehenden Gesamtwertungslogik genau eine weitere, aggregierte Stimme.
 * Nicht platzierte Songs zählen mit 0 Punkten. Die Populations-Standardabweichung
 * wird durch 6 geteilt (maximale Streuung einer 0/12-Verteilung) und auf 0–100
 * begrenzt. Weniger als zwei Stimmen liefern bewusst keinen Index.
 */
export function calculatePolarizationIndex(scores: number[]) {
  const values = scores.filter((value) => Number.isFinite(value)).map((value) => Math.min(12, Math.max(0, value)));
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.round(Math.min(100, (Math.sqrt(variance) / 6) * 100));
}

export function polarizationLabel(value: number | null) {
  if (value === null) return 'noch nicht aussagekräftig';
  if (value < 20) return 'sehr hohe Einigkeit';
  if (value < 40) return 'weitgehend einig';
  if (value < 60) return 'gemischtes Bild';
  if (value < 80) return 'stark umstritten';
  return 'extrem umstritten';
}

function adjacentGap(rows: CombinedResultRow[], mode: 'min' | 'max') {
  const candidates = rows.slice(0, -1).map((row, index) => ({
    first: row,
    second: rows[index + 1],
    gap: Math.max(0, row.total - rows[index + 1].total),
  }));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => mode === 'min' ? a.gap - b.gap : b.gap - a.gap)[0];
}

export function buildReleaseWeekStatistics(
  round: Round,
  songs: Song[],
  summary: AdminRoundSummary,
  juryData: AdminJuryRoundData,
): ReleaseWeekStatistics {
  const activeSongs = songs.filter(isSongActive);
  const activeSongIds = new Set(activeSongs.map((song) => song.id));
  const combined = buildCombinedResults(activeSongs, summary.leaderboard, summary.countedVotes, juryData);
  const publicBySong = new Map(summary.leaderboard.map((row) => [row.song.id, row]));
  const hasAudience = summary.countedVotes > 0;
  const hasJury = combined.submittedJurors.length > 0;
  const audienceRanks = competitionRanks(
    combined.overallRows,
    (row) => publicBySong.get(row.song.id)?.total || 0,
    hasAudience,
  );
  const juryRanks = competitionRanks(combined.overallRows, (row) => row.juryPoints, hasJury);

  const comparisonRows: RankingComparisonRow[] = combined.overallRows.map((row) => {
    const publicRow = publicBySong.get(row.song.id);
    const audienceRank = audienceRanks.get(row) ?? null;
    const juryRank = juryRanks.get(row) ?? null;
    const juryScores = combined.submittedJurors.map((juror) => row.juryPointsByJuror[juror.id] || 0);
    const scores = [
      ...juryScores,
      ...(hasAudience ? [row.audiencePoints] : []),
    ];
    const polarizationIndex = calculatePolarizationIndex(scores);
    return {
      song: row.song,
      overallRank: row.rank,
      audienceRank,
      juryRank,
      audienceRawPoints: publicRow?.total || 0,
      audienceMentions: publicRow?.count || 0,
      audiencePoints: row.audiencePoints,
      juryPoints: row.juryPoints,
      juryAverage: row.juryAverage,
      total: row.total,
      audienceAverage: hasAudience ? (publicRow?.avg ?? 0) : null,
      rankDifference: audienceRank !== null && juryRank !== null ? juryRank - audienceRank : null,
      polarizationIndex,
      polarizationLabel: polarizationLabel(polarizationIndex),
      ratingVoices: scores.length,
      detail: buildSongDetailStatistics(summary.audienceRatingStatsBySong?.[row.song.id], juryScores),
    };
  });

  const totalPoints = combined.overallRows.reduce((sum, row) => sum + row.total, 0);
  const top3Share = percent(combined.overallRows.slice(0, 3).reduce((sum, row) => sum + row.total, 0), totalPoints);
  const top5Share = percent(combined.overallRows.slice(0, 5).reduce((sum, row) => sum + row.total, 0), totalPoints);
  const winnerGap = combined.overallRows.length > 1 && (hasAudience || hasJury)
    ? combined.overallRows[0].total - combined.overallRows[1].total
    : null;
  const winnerGapPercent = winnerGap !== null && combined.overallRows[0].total > 0
    ? percent(winnerGap, combined.overallRows[0].total)
    : null;
  const individualRatings = summary.leaderboard.reduce((sum, row) => sum + row.count, 0)
    + combined.submittedJurors.reduce((sum, juror) => sum + juror.items.filter((item) => activeSongIds.has(item.song_id) && Number(item.points) > 0).length, 0);
  const songsWithoutPoints = combined.overallRows.filter((row) => row.total === 0).length;
  const songsWithoutRatings = comparisonRows.filter((row) => row.audienceMentions === 0 && row.juryPoints === 0).length;
  const ratedComparisons = comparisonRows.filter((row) => row.audienceMentions > 0 || row.juryPoints > 0);
  const averagePolarization = finiteMean(ratedComparisons.map((row) => row.polarizationIndex));
  const rankedComparisons = comparisonRows.filter((row) => row.rankDifference !== null);
  const biggestDeviation = [...rankedComparisons].sort((a, b) => Math.abs(b.rankDifference || 0) - Math.abs(a.rankDifference || 0))[0];
  const audienceFavorite = [...rankedComparisons].sort((a, b) => (b.rankDifference || 0) - (a.rankDifference || 0))[0];
  const juryFavorite = [...rankedComparisons].sort((a, b) => (a.rankDifference || 0) - (b.rankDifference || 0))[0];
  const polarizable = ratedComparisons.filter((row) => row.polarizationIndex !== null);
  const mostPolarizing = [...polarizable].sort((a, b) => (b.polarizationIndex || 0) - (a.polarizationIndex || 0))[0];
  const mostAgreement = [...polarizable].sort((a, b) => (a.polarizationIndex || 0) - (b.polarizationIndex || 0))[0];
  const closest = adjacentGap(combined.overallRows, 'min');
  const zonkRows = summary.zonk.filter((entry) => entry.count > 0);
  const topZonkCount = zonkRows[0]?.count || 0;
  const topZonk = zonkRows.filter((entry) => entry.count === topZonkCount);
  const lastRank = combined.overallRows.at(-1)?.rank ?? null;
  const lastPlaced = lastRank === null ? [] : combined.overallRows.filter((row) => row.rank === lastRank);
  const highlights: StatisticHighlight[] = [];

  if (combined.overallRows[0]?.rank !== null) {
    highlights.push({
      key: 'winner', title: 'Klarster Sieger', value: combined.overallRows[0].song.title,
      detail: winnerGap === null ? `${combined.overallRows[0].total} Gesamtpunkte` : `${winnerGap} Punkte Vorsprung${winnerGapPercent === null ? '' : ` · ${winnerGapPercent.toFixed(1)} % relativ`}`,
      tone: winnerGap !== null && winnerGap <= 2 ? 'warning' : 'success',
      songId: combined.overallRows[0].song.id,
    });
  }
  if (closest) highlights.push({
    key: 'closest', title: 'Knappste Entscheidung', value: `${closest.gap} Punkte`,
    detail: `${closest.first.song.title} / ${closest.second.song.title}`, tone: closest.gap <= 1 ? 'warning' : 'neutral',
  });
  if (comparisonRows.some((row) => row.audienceRank !== null)) {
    const row = comparisonRows.find((item) => item.audienceRank === 1);
    if (row) highlights.push({ key: 'audience', title: 'Publikumsliebling', value: row.song.title, detail: `${row.audienceRawPoints} Publikumspunkte · ${row.audienceMentions} Nennungen`, tone: 'violet', songId: row.song.id });
  }
  if (comparisonRows.some((row) => row.juryRank !== null)) {
    const row = comparisonRows.find((item) => item.juryRank === 1);
    if (row) highlights.push({ key: 'jury', title: 'Jury-Liebling', value: row.song.title, detail: `${row.juryPoints} Jury-Punkte`, tone: 'violet', songId: row.song.id });
  }
  if (biggestDeviation && Math.abs(biggestDeviation.rankDifference || 0) > 0) highlights.push({
    key: 'difference', title: 'Größte Publikum/Jury-Abweichung', value: biggestDeviation.song.title,
    detail: `${Math.abs(biggestDeviation.rankDifference || 0)} Rangplätze Unterschied`, tone: 'warning', songId: biggestDeviation.song.id,
  });
  if (audienceFavorite && (audienceFavorite.rankDifference || 0) > 0) highlights.push({
    key: 'audience-lift', title: 'Beim Publikum deutlich stärker', value: audienceFavorite.song.title,
    detail: `${audienceFavorite.rankDifference} Plätze besser als im Juryranking`, tone: 'violet', songId: audienceFavorite.song.id,
  });
  if (juryFavorite && (juryFavorite.rankDifference || 0) < 0) highlights.push({
    key: 'jury-lift', title: 'Bei der Jury deutlich stärker', value: juryFavorite.song.title,
    detail: `${Math.abs(juryFavorite.rankDifference || 0)} Plätze besser als im Publikumsranking`, tone: 'violet', songId: juryFavorite.song.id,
  });
  if (mostPolarizing) highlights.push({
    key: 'polarizing', title: 'Umstrittenster Song', value: mostPolarizing.song.title,
    detail: `Polarisierungsindex ${mostPolarizing.polarizationIndex}/100 · ${mostPolarizing.polarizationLabel}`, tone: 'warning', songId: mostPolarizing.song.id,
  });
  if (mostAgreement) highlights.push({
    key: 'agreement', title: 'Größte Einigkeit', value: mostAgreement.song.title,
    detail: `Polarisierungsindex ${mostAgreement.polarizationIndex}/100 · ${mostAgreement.polarizationLabel}`, tone: 'success', songId: mostAgreement.song.id,
  });
  if (topZonk.length) highlights.push({
    key: 'zonk', title: 'ZONK', value: topZonk.map((entry) => entry.song.title).join(' / '),
    detail: `${topZonkCount} ZONK-${topZonkCount === 1 ? 'Stimme' : 'Stimmen'} · Gesamtplatz ${comparisonRows.find((row) => row.song.id === topZonk[0].song.id)?.overallRank ?? '—'}`,
    tone: 'danger', songId: topZonk[0].song.id,
  });
  if (lastPlaced.length) highlights.push({
    key: 'last-place', title: 'Letzter Gesamtplatz', value: lastPlaced.map((row) => row.song.title).join(' / '),
    detail: `Platz ${lastRank} · ${lastPlaced[0].total} Gesamtpunkte`, tone: 'neutral', songId: lastPlaced[0].song.id,
  });

  return {
    round,
    songsCount: activeSongs.length,
    totalVotes: summary.totalVotes,
    countedVotes: summary.countedVotes,
    confirmedVotes: summary.confirmedVotes,
    reviewVotes: summary.reviewVotes,
    excludedVotes: summary.excludedVotes,
    unverifiedVotes: summary.unverifiedVotes,
    activeJurors: combined.activeJurors.length,
    submittedJurors: combined.submittedJurors.length,
    individualRatings,
    winnerGap,
    winnerGapPercent,
    top3Share,
    top5Share,
    songsWithoutPoints,
    songsWithoutRatings,
    averagePolarization,
    comparisonRows,
    overallRows: combined.overallRows,
    highlights,
    zonk: summary.zonk,
    hasActivity: hasAudience || hasJury,
  };
}

export function buildWeekComparison(current: ReleaseWeekStatistics, allWeeks: ReleaseWeekStatistics[]): WeekComparisonMetric[] {
  const previous = allWeeks.filter((week) => week.round.id !== current.round.id && week.hasActivity);
  const metric = (
    key: WeekComparisonMetric['key'],
    label: string,
    currentValue: number | null,
    values: Array<number | null>,
    unit: WeekComparisonMetric['unit'],
  ): WeekComparisonMetric => {
    const average = finiteMean(values);
    return { key, label, current: currentValue, average, delta: currentValue !== null && average !== null ? currentValue - average : null, unit };
  };
  return [
    metric('participants', 'Gewertete Publikumsstimmen', current.countedVotes, previous.map((week) => week.countedVotes), 'number'),
    metric('polarization', 'Ø Polarisierungsindex', current.averagePolarization, previous.map((week) => week.averagePolarization), 'points'),
    metric('winnerGap', 'Abstand Platz 1–2', current.winnerGap, previous.map((week) => week.winnerGap), 'points'),
    metric('top3Share', 'Punkteanteil Top 3', current.top3Share, previous.map((week) => week.top3Share), 'percent'),
    metric('top5Share', 'Punkteanteil Top 5', current.top5Share, previous.map((week) => week.top5Share), 'percent'),
  ];
}

function normalizeArtist(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

/**
 * Zerlegt eine Song-Künstlerangabe in einzelne Credits. Getrennt werden nur
 * eindeutige Kollaborations-Trenner (Komma, Semikolon, „feat./ft.“, „x“, „&“
 * mit Leerzeichen sowie Schrägstrich). Zeichen innerhalb eines bestehenden
 * Künstlernamens wie bei „Buffalo&Wallace“ bleiben bewusst erhalten.
 */
export function splitArtistCredits(value: string) {
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean) return ['Ohne Künstlerangabe'];
  const names = clean
    .split(/\s*(?:,|;|\/|\s+\+\s+|\s+[x×]\s+|\s+&\s+|\s+(?:feat(?:uring)?|ft)\.?\s+)\s*/i)
    .map((name) => name.trim())
    .filter(Boolean);
  const unique = new Map<string, string>();
  for (const name of names.length ? names : [clean]) {
    const key = normalizeArtist(name);
    if (!unique.has(key)) unique.set(key, name);
  }
  return [...unique.values()];
}

/**
 * Rekonstruiert die Künstlerangabe auch bei älteren Songzeilen, die vor der
 * Korrektur des Import-Parsers am ersten statt am letzten Bindestrich getrennt
 * wurden. Beispiel aus dem Archiv:
 *
 * Titel:     "HURENSOHN"
 * Künstler: "JEBROER REMIX - Rumbombe, Jebroer"
 *
 * Aus der zusammengesetzten Originalzeile wird dadurch wieder
 * "HURENSOHN - JEBROER REMIX" / "Rumbombe, Jebroer". Die gespeicherten
 * Daten werden nicht verändert; die Reparatur gilt nur für die Statistik.
 */
function artistCreditsForStatistics(song: Pick<Song, 'title' | 'artist'>) {
  const artist = String(song.artist || '').trim();
  if (!artist) return splitArtistCredits('');
  const reconstructed = splitSongLine(`${String(song.title || '').trim()} - ${artist}`);
  return splitArtistCredits(reconstructed.artist || artist);
}

export function buildArtistHistories(weeks: ReleaseWeekStatistics[]): ArtistHistory[] {
  const groups = new Map<string, { name: string; entries: ArtistHistoryEntry[] }>();
  for (const week of weeks) {
    for (const row of week.comparisonRows) {
      for (const name of artistCreditsForStatistics(row.song)) {
        const key = normalizeArtist(name);
        const group = groups.get(key) || { name, entries: [] };
        group.entries.push({
          roundId: week.round.id,
          roundTitle: week.round.title,
          date: roundDate(week.round),
          songId: row.song.id,
          songTitle: row.song.title,
          overallRank: row.overallRank,
          audienceRank: row.audienceRank,
          juryRank: row.juryRank,
          overallPoints: row.total,
          audiencePoints: row.audiencePoints,
          juryPoints: row.juryPoints,
        });
        groups.set(key, group);
      }
    }
  }

  return [...groups.entries()].map(([key, group]) => {
    const entries = [...group.entries].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const ranks = entries.map((entry) => entry.overallRank).filter((rank): rank is number => rank !== null);
    const audienceRanks = entries.map((entry) => entry.audienceRank).filter((rank): rank is number => rank !== null);
    const juryRanks = entries.map((entry) => entry.juryRank).filter((rank): rank is number => rank !== null);
    return {
      key,
      name: group.name,
      participations: entries.length,
      averageRank: finiteMean(ranks),
      bestRank: ranks.length ? Math.min(...ranks) : null,
      worstRank: ranks.length ? Math.max(...ranks) : null,
      wins: ranks.filter((rank) => rank === 1).length,
      top3: ranks.filter((rank) => rank <= 3).length,
      top5: ranks.filter((rank) => rank <= 5).length,
      averageAudienceRank: finiteMean(audienceRanks),
      averageJuryRank: finiteMean(juryRanks),
      lastParticipation: entries.at(-1)?.date || null,
      entries,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
}

export function formatReportPeriod(round: Round) {
  const formatter = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const format = (value: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : formatter.format(date);
  };
  const start = format(round.starts_at);
  const end = format(round.ends_at);
  return start && end ? `${start} – ${end}` : start || end || 'Zeitraum nicht festgelegt';
}

export function buildReportGraphicData(stats: ReleaseWeekStatistics): ReportGraphicData {
  const winner = stats.overallRows.find((row) => row.rank === 1) || null;
  return {
    roundId: stats.round.id,
    title: stats.round.title,
    period: formatReportPeriod(stats.round),
    songsCount: stats.songsCount,
    totalVotes: stats.totalVotes,
    countedVotes: stats.countedVotes,
    individualRatings: stats.individualRatings,
    juryStatus: `${stats.submittedJurors}/${stats.activeJurors} abgegeben`,
    winner: winner?.song.title || 'Noch kein Ergebnis',
    winnerPoints: winner?.total ?? null,
    winnerGap: stats.winnerGap,
    winnerGapPercent: stats.winnerGapPercent,
    top3Share: stats.top3Share,
    top5Share: stats.top5Share,
    averagePolarization: stats.averagePolarization,
    songsWithoutPoints: stats.songsWithoutPoints,
    songsWithoutRatings: stats.songsWithoutRatings,
    highlights: stats.highlights,
    results: stats.overallRows.map((row) => ({
      rank: row.rank,
      title: row.song.title,
      artist: row.song.artist,
      audiencePoints: row.audiencePoints,
      juryPoints: row.juryPoints,
      total: row.total,
    })),
  };
}

export function sortWeeksNewestFirst(weeks: ReleaseWeekStatistics[]) {
  return [...weeks].sort((a, b) => Date.parse(roundDate(b.round)) - Date.parse(roundDate(a.round)) || b.round.title.localeCompare(a.round.title));
}

export function sortComparisonRows(rows: RankingComparisonRow[]) {
  return [...rows].sort((a, b) => (a.overallRank ?? Number.MAX_SAFE_INTEGER) - (b.overallRank ?? Number.MAX_SAFE_INTEGER) || compareResultSongs(a.song, b.song));
}
