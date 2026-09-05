import type { AdminJuryRoundData, AdminJuryJurorRow } from './juryVoting';
import { isSongActive, JURY_PLACES_COUNT, type LeaderboardRow, type Song } from './releaseVotingShared';

export type AudienceResultRow = LeaderboardRow & {
  rank: number;
  audiencePoints: number;
};

export type CombinedResultRow = {
  song: Song;
  juryPointsByJuror: Record<string, number>;
  juryPoints: number;
  juryAverage: number | null;
  audiencePoints: number;
  total: number;
  overallAverage: number | null;
  rank: number | null;
};

export type JurorRanking = {
  juror: AdminJuryJurorRow;
  rows: Array<{ song: Song; points: number; rank: number }>;
};

export function compareResultSongs(a: Song, b: Song) {
  return a.title.localeCompare(b.title, 'de', { sensitivity: 'base' })
    || a.artist.localeCompare(b.artist, 'de', { sensitivity: 'base' });
}

export function buildAudienceResults(publicLeaderboard: LeaderboardRow[], publicVerifiedVotes: number): AudienceResultRow[] {
  if (publicVerifiedVotes <= 0) return [];
  const sorted = [...publicLeaderboard].sort((a, b) => b.total - a.total || compareResultSongs(a.song, b.song));
  return sorted.slice(0, JURY_PLACES_COUNT).map((row, index) => ({
    ...row,
    rank: index + 1,
    audiencePoints: JURY_PLACES_COUNT - index,
  }));
}

export function buildCombinedResults(
  songs: Song[],
  publicLeaderboard: LeaderboardRow[],
  publicVerifiedVotes: number,
  juryData: AdminJuryRoundData,
) {
  const activeSongs = songs.filter(isSongActive);
  // DJ-Rankings sind eine eigene redaktionelle Kategorie und dürfen niemals
  // in die normale Jury-plus-Publikum-Gesamtwertung einfließen.
  const activeJurors = juryData.jurors.filter((juror) => juror.is_active && (!juror.voting_role || juror.voting_role === 'jury'));
  const submittedJurors = activeJurors.filter((juror) => Boolean(juror.submitted_at));
  const audienceResults = buildAudienceResults(publicLeaderboard, publicVerifiedVotes);
  const audiencePoints = new Map(audienceResults.map((row) => [row.song.id, row.audiencePoints]));
  const juryPointsByJuror = new Map<string, Map<string, number>>();

  for (const juror of activeJurors) {
    const points = new Map<string, number>();
    if (juror.submitted_at) {
      for (const item of juror.items) {
        const value = Number(item.points);
        if (Number.isFinite(value) && value >= 1 && value <= JURY_PLACES_COUNT) points.set(item.song_id, value);
      }
    }
    juryPointsByJuror.set(juror.id, points);
  }

  const hasAudience = publicVerifiedVotes > 0;
  const overallRatingVoices = submittedJurors.length + (hasAudience ? 1 : 0);
  const hasVotes = overallRatingVoices > 0;
  const unranked = activeSongs.map((song) => {
    const perJuror: Record<string, number> = {};
    let juryPoints = 0;
    for (const juror of activeJurors) {
      const points = juryPointsByJuror.get(juror.id)?.get(song.id) || 0;
      perJuror[juror.id] = points;
      juryPoints += points;
    }
    const publicPoints = audiencePoints.get(song.id) || 0;
    const juryAverage = submittedJurors.length ? juryPoints / submittedJurors.length : null;
    const total = juryPoints + publicPoints;
    const overallAverage = overallRatingVoices ? total / overallRatingVoices : null;
    return { song, juryPointsByJuror: perJuror, juryPoints, juryAverage, audiencePoints: publicPoints, total, overallAverage };
  });

  unranked.sort((a, b) => b.total - a.total || compareResultSongs(a.song, b.song));
  let previousTotal: number | null = null;
  let previousRank = 0;
  const overallRows: CombinedResultRow[] = unranked.map((row, index) => {
    if (!hasVotes) return { ...row, rank: null };
    const rank = previousTotal === row.total ? previousRank : index + 1;
    previousTotal = row.total;
    previousRank = rank;
    return { ...row, rank };
  });

  const jurorRankings: JurorRanking[] = activeJurors.map((juror) => {
    const points = juryPointsByJuror.get(juror.id) || new Map<string, number>();
    const rows = activeSongs
      .map((song) => ({ song, points: points.get(song.id) || 0 }))
      .filter((row) => row.points > 0)
      .sort((a, b) => b.points - a.points || compareResultSongs(a.song, b.song))
      .map((row, index) => ({ ...row, rank: index + 1 }));
    return { juror, rows };
  });

  return { activeJurors, submittedJurors, audienceResults, audiencePoints, juryPointsByJuror, overallRows, jurorRankings };
}
