import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import AdminDashboard from '@/components/AdminDashboard';
import { DEFAULT_IMPRESSUM, getSetting } from '@/lib/settings';
import {
  buildLeaderboard,
  buildZonk,
  getAllVotes,
  getCurrentRound,
  getSongs,
  listRounds,
  type AdminRoundSummary,
  type Song,
  type Vote,
  type VoteItem,
} from '@/lib/releaseVoting';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');

  const rounds = await listRounds();
  const current = await getCurrentRound();
  const songs = current ? await getSongs(current.id) : [];
  const votes = current ? await getAllVotes(current.id) : [];

  const sb = getSupabaseAdminClient();
  let items: VoteItem[] = [];
  let roundSummaries: AdminRoundSummary[] = [];

  if (sb && votes.length) {
    const { data } = await sb.from('release_voting_vote_items').select('*').in('vote_id', votes.map((vote) => vote.id));
    items = (data || []) as VoteItem[];
  }

  if (sb && rounds.length) {
    const roundIds = rounds.map((round) => round.id);

    const [{ data: allSongsData }, { data: allVotesData }] = await Promise.all([
      sb.from('release_voting_songs').select('*').in('round_id', roundIds).order('sort_order'),
      sb.from('release_voting_votes').select('*').in('round_id', roundIds).order('created_at', { ascending: false }),
    ]);

    const allSongs = (allSongsData || []) as Song[];
    const allVotes = (allVotesData || []) as Vote[];
    const allVoteIds = allVotes.map((vote) => vote.id);

    let allItems: VoteItem[] = [];
    if (allVoteIds.length) {
      const { data: allItemsData } = await sb.from('release_voting_vote_items').select('*').in('vote_id', allVoteIds);
      allItems = (allItemsData || []) as VoteItem[];
    }

    roundSummaries = rounds.map((round) => {
      const roundSongs = allSongs.filter((song) => song.round_id === round.id);
      const roundVotes = allVotes.filter((vote) => vote.round_id === round.id);
      const verifiedVotes = roundVotes.filter((vote) => vote.is_verified);
      const verifiedVoteIds = new Set(verifiedVotes.map((vote) => vote.id));
      const roundItems = allItems.filter((item) => verifiedVoteIds.has(item.vote_id));
      const leaderboard = buildLeaderboard(roundSongs, verifiedVotes, roundItems);
      const zonk = buildZonk(roundSongs, verifiedVotes);

      return {
        roundId: round.id,
        totalVotes: roundVotes.length,
        verifiedVotes: verifiedVotes.length,
        pendingVotes: roundVotes.length - verifiedVotes.length,
        songsCount: roundSongs.length,
        leaderboard,
        zonk,
      };
    });
  }

  const impressum = await getSetting('impressum_text', DEFAULT_IMPRESSUM);

  return (
    <AdminDashboard
      rounds={rounds}
      currentRound={current}
      songs={songs}
      votes={votes}
      items={items}
      roundSummaries={roundSummaries}
      impressum={impressum}
    />
  );
}
