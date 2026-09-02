import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import { getAllVotes, getVoteItemsForVoteIds } from './releaseVoting';
import type { Song } from './releaseVotingShared';

export type AdminDjParticipantRanking = {
  voteId: string;
  name: string;
  createdAt: string;
  verifiedAt: string | null;
  status: 'unverified' | 'counted' | 'review' | 'excluded';
  rows: Array<{ song: Song; points: number }>;
};

export async function getAdminDjParticipantRankings(roundId: string, songs: Song[]): Promise<AdminDjParticipantRanking[]> {
  noStore();
  const votes = await getAllVotes(roundId, 'dj');
  const items = await getVoteItemsForVoteIds(votes.map((vote) => vote.id));
  const songById = new Map(songs.map((song) => [song.id, song]));
  const itemsByVote = new Map<string, typeof items>();
  for (const item of items) itemsByVote.set(item.vote_id, [...(itemsByVote.get(item.vote_id) || []), item]);

  return votes.map((vote) => ({
    voteId: vote.id,
    name: vote.juror_name || 'DJ ohne Namen',
    createdAt: vote.created_at,
    verifiedAt: vote.verified_at,
    status: !vote.is_verified ? 'unverified'
      : vote.integrity_status === 'excluded' ? 'excluded'
        : vote.is_counted === false ? 'review' : 'counted',
    rows: (itemsByVote.get(vote.id) || [])
      .map((item) => ({ song: songById.get(item.song_id), points: Number(item.points) }))
      .filter((row): row is { song: Song; points: number } => Boolean(row.song))
      .sort((a, b) => b.points - a.points),
  }));
}
