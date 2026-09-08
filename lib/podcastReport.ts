import type { AdminJuryRoundData } from './juryVoting';
import { buildCombinedResults, compareResultSongs } from './combinedVotingResults';
import { buildReleaseWeekStatistics } from './releaseStatisticsCore';
import { buildCombinedZonkResults, buildPublicZonkResults } from './zonkResults';
import type { AdminRoundSummary, Round, Song } from './releaseVotingShared';

export type PodcastReportJuror = {
  id: string;
  name: string;
  submitted: boolean;
  rows: Array<{ rank: number; title: string; artist: string; points: number }>;
  zonk: string | null;
};

export type PodcastReportData = {
  roundId: string;
  title: string;
  period: string;
  summary: {
    songs: number;
    totalAudienceVotes: number;
    countedAudienceVotes: number;
    activeJurors: number;
    submittedJurors: number;
    winnerGap: number | null;
  };
  quick: {
    overallWinner: string;
    overallWinnerDetail: string;
    juryWinner: string;
    juryWinnerDetail: string;
    audienceWinner: string;
    audienceWinnerDetail: string;
    zonkWinner: string;
    zonkWinnerDetail: string;
    strongestSplit: string;
    strongestSplitDetail: string;
  };
  jurors: PodcastReportJuror[];
  audienceCard: {
    rows: Array<{ rank: number; title: string; artist: string; points: number }>;
    zonk: string | null;
  };
  overallRows: Array<{
    rank: number | null;
    title: string;
    artist: string;
    jurorPoints: Array<{ jurorId: string; points: number | null }>;
    juryPoints: number;
    juryAverage: number | null;
    audiencePoints: number;
    total: number;
    overallAverage: number | null;
  }>;
  songRatingRows: Array<{
    rank: number | null;
    title: string;
    artist: string;
    juryRank: number | null;
    audienceRank: number | null;
    juryAverage: number | null;
    audienceAverage: number | null;
    overallAverage: number | null;
    audienceMentions: number;
    rankDifference: number | null;
    polarizationIndex: number | null;
  }>;
  audienceRows: Array<{
    rank: number;
    title: string;
    artist: string;
    total: number;
    average: number;
    mentions: number;
    share: number | null;
    audiencePoints: number;
  }>;
  zonkRows: Array<{
    rank: number;
    title: string;
    artist: string;
    audience: number;
    jury: number;
    total: number;
  }>;
};

function roundPeriod(round: Round) {
  const raw = round.starts_at || round.ends_at || round.created_at;
  if (!raw) return '';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function songLabel(song: Song | undefined | null) {
  return song ? `${song.title} — ${song.artist}` : '—';
}

function rankJuryRows(rows: ReturnType<typeof buildCombinedResults>['overallRows'], hasVotes: boolean) {
  const sorted = [...rows].sort((a, b) => b.juryPoints - a.juryPoints || (b.juryAverage || 0) - (a.juryAverage || 0) || compareResultSongs(a.song, b.song));
  let previousPoints: number | null = null;
  let previousRank = 0;
  return sorted.map((row, index) => {
    if (!hasVotes) return { ...row, juryRank: null as number | null };
    const rank = previousPoints === row.juryPoints ? previousRank : index + 1;
    previousPoints = row.juryPoints;
    previousRank = rank;
    return { ...row, juryRank: rank as number | null };
  });
}

export function buildPodcastReportData(
  round: Round,
  songs: Song[],
  summary: AdminRoundSummary,
  juryData: AdminJuryRoundData,
): PodcastReportData {
  const combined = buildCombinedResults(songs, summary.leaderboard, summary.countedVotes, juryData);
  const stats = buildReleaseWeekStatistics(round, songs, summary, juryData);
  const songById = new Map(songs.map((song) => [song.id, song]));
  const juryRanked = rankJuryRows(combined.overallRows, combined.submittedJurors.length > 0);
  const juryWinners = juryRanked.filter((row) => row.juryRank === 1);
  const juryWinner = juryWinners[0];
  const audienceWinner = combined.audienceResults[0];
  const combinedZonk = buildCombinedZonkResults(songs, summary.zonk, juryData);
  const topZonkCount = combinedZonk[0]?.total || 0;
  const topZonks = combinedZonk.filter((row) => row.total === topZonkCount);
  const publicZonk = buildPublicZonkResults(summary.zonk);
  const publicTopCount = publicZonk[0]?.count || 0;
  const publicTopZonks = publicZonk.filter((row) => row.count === publicTopCount);
  const biggestSplit = [...stats.comparisonRows]
    .filter((row) => row.rankDifference !== null)
    .sort((a, b) => Math.abs(b.rankDifference || 0) - Math.abs(a.rankDifference || 0))[0];
  const overallWinners = combined.overallRows.filter((row) => row.rank === 1);
  const overallWinner = overallWinners[0];

  return {
    roundId: round.id,
    title: round.title,
    period: roundPeriod(round),
    summary: {
      songs: songs.length,
      totalAudienceVotes: summary.totalVotes,
      countedAudienceVotes: summary.countedVotes,
      activeJurors: combined.activeJurors.length,
      submittedJurors: combined.submittedJurors.length,
      winnerGap: stats.winnerGap,
    },
    quick: {
      overallWinner: overallWinners.length ? overallWinners.map((row) => songLabel(row.song)).join(' / ') : '—',
      overallWinnerDetail: overallWinner ? `${overallWinner.total} Gesamtpunkte · Ø ${overallWinner.overallAverage?.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? '—'}` : 'Noch keine Gesamtwertung',
      juryWinner: juryWinners.length ? juryWinners.map((row) => songLabel(row.song)).join(' / ') : '—',
      juryWinnerDetail: juryWinner ? `${juryWinner.juryPoints} Jurypunkte · Ø ${juryWinner.juryAverage?.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? '—'}` : 'Noch keine Jurywertung',
      audienceWinner: songLabel(audienceWinner?.song),
      audienceWinnerDetail: audienceWinner ? `${audienceWinner.total} Publikumspunkte · Ø ${audienceWinner.avg.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` : 'Noch keine Publikumswertung',
      zonkWinner: topZonks.length ? topZonks.map((row) => songLabel(row.song)).join(' / ') : '—',
      zonkWinnerDetail: topZonks.length ? `${topZonkCount} ZONK-Stimme${topZonkCount === 1 ? '' : 'n'} gesamt` : 'Noch kein ZONK',
      strongestSplit: biggestSplit ? songLabel(biggestSplit.song) : '—',
      strongestSplitDetail: biggestSplit?.rankDifference == null
        ? 'Noch kein Jury-/Publikumsvergleich'
        : `${Math.abs(biggestSplit.rankDifference)} Plätze Unterschied · Jury #${biggestSplit.juryRank ?? '—'} / Publikum #${biggestSplit.audienceRank ?? '—'}`,
    },
    jurors: combined.jurorRankings.map((ranking) => ({
      id: ranking.juror.id,
      name: ranking.juror.display_name,
      submitted: Boolean(ranking.juror.submitted_at),
      rows: ranking.rows.map((row) => ({ rank: row.rank, title: row.song.title, artist: row.song.artist, points: row.points })),
      zonk: ranking.juror.submitted_at && ranking.juror.zonk_song_id ? songLabel(songById.get(ranking.juror.zonk_song_id)) : null,
    })),
    audienceCard: {
      rows: combined.audienceResults.map((row) => ({ rank: row.rank, title: row.song.title, artist: row.song.artist, points: row.audiencePoints })),
      zonk: publicTopZonks.length ? publicTopZonks.map((row) => `${songLabel(row.song)} (${row.count})`).join(' / ') : null,
    },
    overallRows: combined.overallRows.map((row) => ({
      rank: row.rank,
      title: row.song.title,
      artist: row.song.artist,
      jurorPoints: combined.activeJurors.map((juror) => ({ jurorId: juror.id, points: juror.submitted_at ? (row.juryPointsByJuror[juror.id] || 0) : null })),
      juryPoints: row.juryPoints,
      juryAverage: row.juryAverage,
      audiencePoints: row.audiencePoints,
      total: row.total,
      overallAverage: row.overallAverage,
    })),
    songRatingRows: stats.comparisonRows.map((row) => ({
      rank: row.overallRank,
      title: row.song.title,
      artist: row.song.artist,
      juryRank: row.juryRank,
      audienceRank: row.audienceRank,
      juryAverage: row.juryAverage,
      audienceAverage: row.audienceAverage,
      overallAverage: row.overallAverage,
      audienceMentions: row.audienceMentions,
      rankDifference: row.rankDifference,
      polarizationIndex: row.polarizationIndex,
    })),
    audienceRows: combined.audienceResults.map((row) => ({
      rank: row.rank,
      title: row.song.title,
      artist: row.song.artist,
      total: row.total,
      average: row.avg,
      mentions: row.count,
      share: summary.countedVotes ? (row.count / summary.countedVotes) * 100 : null,
      audiencePoints: row.audiencePoints,
    })),
    zonkRows: combinedZonk.map((row) => ({
      rank: row.rank,
      title: row.song.title,
      artist: row.song.artist,
      audience: row.audienceCount,
      jury: row.juryCount,
      total: row.total,
    })),
  };
}
