import type { AdminJuryRoundData } from './juryVoting';
import { isSongActive, type Song, type ZonkRow } from './releaseVotingShared';

export type RankedZonkRow = {
  rank: number;
  song: Song;
  count: number;
};

export type CombinedZonkRow = {
  rank: number;
  song: Song;
  audienceCount: number;
  juryCount: number;
  total: number;
};

function rankByCount(rows: Array<{ song: Song; count: number }>): RankedZonkRow[] {
  const sorted = [...rows]
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.song.title.localeCompare(b.song.title) || a.song.artist.localeCompare(b.song.artist));

  let previousCount: number | null = null;
  let previousRank = 0;
  return sorted.map((row, index) => {
    const rank = previousCount === row.count ? previousRank : index + 1;
    previousCount = row.count;
    previousRank = rank;
    return { ...row, rank };
  });
}

export function buildPublicZonkResults(zonkRows: ZonkRow[]): RankedZonkRow[] {
  return rankByCount(zonkRows.map((row) => ({ song: row.song, count: Number(row.count) || 0 })));
}

export function buildJuryZonkResults(songs: Song[], juryData: AdminJuryRoundData): RankedZonkRow[] {
  const activeSongs = songs.filter(isSongActive);
  const songById = new Map(activeSongs.map((song) => [song.id, song]));
  const counts = new Map<string, number>();

  for (const juror of juryData.jurors) {
    if (!juror.is_active || !juror.submitted_at || !juror.zonk_song_id || !songById.has(juror.zonk_song_id)) continue;
    counts.set(juror.zonk_song_id, (counts.get(juror.zonk_song_id) || 0) + 1);
  }

  return rankByCount(activeSongs.map((song) => ({ song, count: counts.get(song.id) || 0 })));
}

export function buildCombinedZonkResults(
  songs: Song[],
  publicZonkRows: ZonkRow[],
  juryData: AdminJuryRoundData,
): CombinedZonkRow[] {
  const activeSongs = songs.filter(isSongActive);
  const publicCounts = new Map(publicZonkRows.map((row) => [row.song.id, Number(row.count) || 0]));
  const juryCounts = new Map<string, number>();

  for (const juror of juryData.jurors) {
    if (!juror.is_active || !juror.submitted_at || !juror.zonk_song_id) continue;
    juryCounts.set(juror.zonk_song_id, (juryCounts.get(juror.zonk_song_id) || 0) + 1);
  }

  const sorted = activeSongs
    .map((song) => {
      const audienceCount = publicCounts.get(song.id) || 0;
      const juryCount = juryCounts.get(song.id) || 0;
      return { song, audienceCount, juryCount, total: audienceCount + juryCount };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || b.audienceCount - a.audienceCount || b.juryCount - a.juryCount || a.song.title.localeCompare(b.song.title) || a.song.artist.localeCompare(b.song.artist));

  let previousTotal: number | null = null;
  let previousRank = 0;
  return sorted.map((row, index) => {
    const rank = previousTotal === row.total ? previousRank : index + 1;
    previousTotal = row.total;
    previousRank = rank;
    return { ...row, rank };
  });
}
