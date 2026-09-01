import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdminClient } from './supabaseAdmin';
import type { Round, Vote } from './releaseVotingShared';

export type AdminRoundOverview = {
  roundId: string;
  songsCount: number;
  jurorsCount: number;
  jurySubmitted: number;
  totalVotes: number;
  confirmedVotes: number;
  countedVotes: number;
  reviewVotes: number;
  excludedVotes: number;
  unverifiedVotes: number;
};

type SongRef = { id: string; round_id: string };
type JurorRef = { id: string; round_id: string; is_active: boolean };
type JuryVoteRef = { round_id: string; round_juror_id: string; submitted_at: string | null };

export async function getAdminRoundOverviews(rounds: Round[]): Promise<AdminRoundOverview[]> {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb || !rounds.length) return [];

  const roundIds = rounds.map((round) => round.id);
  const [votesResult, songsResult, jurorsResult, juryVotesResult] = await Promise.all([
    sb.from('release_voting_votes').select('*').in('round_id', roundIds),
    sb.from('release_voting_songs').select('id,round_id').in('round_id', roundIds),
    sb.from('release_voting_round_jurors').select('id,round_id,is_active').in('round_id', roundIds),
    sb.from('release_voting_jury_votes').select('round_id,round_juror_id,submitted_at').in('round_id', roundIds),
  ]);

  const votes = (votesResult.data || []) as Vote[];
  const songs = (songsResult.data || []) as SongRef[];
  const jurors = (jurorsResult.data || []) as JurorRef[];
  const juryVotes = (juryVotesResult.data || []) as JuryVoteRef[];

  return rounds.map((round) => {
    const roundVotes = votes.filter((vote) => vote.round_id === round.id);
    const activeJurors = jurors.filter((juror) => juror.round_id === round.id && juror.is_active !== false);
    const activeJurorIds = new Set(activeJurors.map((juror) => juror.id));
    const submittedJurorIds = new Set(
      juryVotes
        .filter((vote) => vote.round_id === round.id && vote.submitted_at && activeJurorIds.has(vote.round_juror_id))
        .map((vote) => vote.round_juror_id)
    );
    const confirmedVotes = roundVotes.filter((vote) => Boolean(vote.is_verified)).length;
    const countedVotes = roundVotes.filter((vote) => Boolean(vote.is_verified) && vote.is_counted !== false).length;
    const excludedVotes = roundVotes.filter((vote) => Boolean(vote.is_verified) && vote.integrity_status === 'excluded').length;
    const reviewVotes = roundVotes.filter((vote) => Boolean(vote.is_verified) && vote.is_counted === false && vote.integrity_status !== 'excluded').length;

    return {
      roundId: round.id,
      songsCount: songs.filter((song) => song.round_id === round.id).length,
      jurorsCount: activeJurors.length,
      jurySubmitted: submittedJurorIds.size,
      totalVotes: roundVotes.length,
      confirmedVotes,
      countedVotes,
      reviewVotes,
      excludedVotes,
      unverifiedVotes: roundVotes.length - confirmedVotes,
    };
  });
}

export function emptyAdminRoundOverview(roundId: string): AdminRoundOverview {
  return { roundId, songsCount: 0, jurorsCount: 0, jurySubmitted: 0, totalVotes: 0, confirmedVotes: 0, countedVotes: 0, reviewVotes: 0, excludedVotes: 0, unverifiedVotes: 0 };
}
