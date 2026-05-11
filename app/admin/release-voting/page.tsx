import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import AdminDashboard from '@/components/AdminDashboard';
import { DEFAULT_IMPRESSUM, getSetting } from '@/lib/settings';
import { getCurrentRound, listRounds, type AdminRoundSummary, type Vote } from '@/lib/releaseVoting';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');

  const rounds = await listRounds();
  const current = await getCurrentRound();
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
      const verifiedVotes = roundVotes.filter((vote) => vote.is_verified);

      return {
        roundId: round.id,
        totalVotes: roundVotes.length,
        verifiedVotes: verifiedVotes.length,
        pendingVotes: roundVotes.length - verifiedVotes.length,
        songsCount: 0,
        leaderboard: [],
        zonk: [],
        participants: [],
      };
    });
  }

  const impressum = await getSetting('impressum_text', DEFAULT_IMPRESSUM);

  return <AdminDashboard rounds={rounds} currentRound={current} roundSummaries={roundSummaries} impressum={impressum} />;
}
