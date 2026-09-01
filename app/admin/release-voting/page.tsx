import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import AdminDashboard from '@/components/AdminDashboard';
import { DEFAULT_IMPRESSUM, getSetting } from '@/lib/settings';
import { getCurrentDjRound, getCurrentRound, listRounds, type AdminRoundSummary, type Vote } from '@/lib/releaseVoting';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function Admin() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');

  const rounds = await listRounds();
  const current = await getCurrentRound();
  const currentDjRound = await getCurrentDjRound();
  const sb = getSupabaseAdminClient();
  let roundSummaries: AdminRoundSummary[] = [];

  if (sb && rounds.length) {
    const roundIds = rounds.map((round) => round.id);
    const { data: allVotesData } = await sb
      .from('release_voting_votes')
      .select('*')
      .in('round_id', roundIds)
      .order('created_at', { ascending: false });

    const allVotes = (allVotesData || []) as Vote[];

    roundSummaries = rounds.map((round) => {
      const roundVotes = allVotes.filter((vote) => vote.round_id === round.id);
      const confirmedVotes = roundVotes.filter((vote) => vote.is_verified).length;
      const countedVotes = roundVotes.filter((vote) => vote.is_verified && vote.is_counted !== false).length;
      const excludedVotes = roundVotes.filter((vote) => vote.is_verified && vote.integrity_status === 'excluded').length;
      const reviewVotes = roundVotes.filter((vote) =>
        vote.is_verified
        && vote.is_counted === false
        && vote.integrity_status !== 'excluded'
      ).length;
      const unverifiedVotes = roundVotes.length - confirmedVotes;

      return {
        roundId: round.id,
        totalVotes: roundVotes.length,
        confirmedVotes,
        countedVotes,
        reviewVotes,
        excludedVotes,
        unverifiedVotes,
        verifiedVotes: countedVotes,
        pendingVotes: unverifiedVotes,
        songsCount: 0,
        leaderboard: [],
        zonk: [],
        participants: [],
      };
    });
  }

  const impressum = await getSetting('impressum_text', DEFAULT_IMPRESSUM);

  return <AdminDashboard rounds={rounds} currentRound={current} currentDjRound={currentDjRound} roundSummaries={roundSummaries} impressum={impressum} />;
}
