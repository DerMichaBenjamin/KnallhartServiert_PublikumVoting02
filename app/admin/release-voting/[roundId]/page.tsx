import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import AdminRoundDetail from '@/components/AdminRoundDetail';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import {
  buildLeaderboard,
  buildZonk,
  combineSongLine,
  getAllVotes,
  getSongs,
  type AdminRoundSummary,
  type Round,
  type VoteItem,
} from '@/lib/releaseVoting';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ roundId: string }>;
};

export default async function AdminRoundPage({ params }: PageProps) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');

  const { roundId } = await params;
  const sb = getSupabaseAdminClient();
  if (!sb) notFound();

  const { data: roundData } = await sb
    .from('release_voting_rounds')
    .select('*')
    .eq('id', roundId)
    .maybeSingle();

  if (!roundData) notFound();

  const round = roundData as Round;
  const songs = await getSongs(round.id);
  const votes = await getAllVotes(round.id);
  const voteIds = votes.map((vote) => vote.id);

  let items: VoteItem[] = [];
  if (voteIds.length) {
    const { data: itemData } = await sb
      .from('release_voting_vote_items')
      .select('*')
      .in('vote_id', voteIds);

    items = (itemData || []) as VoteItem[];
  }

  const verifiedVotes = votes.filter((vote) => vote.is_verified);
  const verifiedVoteIds = new Set(verifiedVotes.map((vote) => vote.id));
  const verifiedItems = items.filter((item) => verifiedVoteIds.has(item.vote_id));
  const songById = new Map(songs.map((song) => [song.id, song]));

  const summary: AdminRoundSummary = {
    roundId: round.id,
    totalVotes: votes.length,
    verifiedVotes: verifiedVotes.length,
    pendingVotes: votes.length - verifiedVotes.length,
    songsCount: songs.length,
    leaderboard: buildLeaderboard(songs, verifiedVotes, verifiedItems),
    zonk: buildZonk(songs, verifiedVotes),
    participants: votes.map((vote) => {
      const zonkSong = vote.zonk_song_id ? songById.get(vote.zonk_song_id) : null;

      return {
        voteId: vote.id,
        name: vote.juror_name || '',
        email: vote.juror_email || '',
        instagram: vote.juror_instagram || null,
        isVerified: Boolean(vote.is_verified),
        votedAt: vote.created_at,
        verifiedAt: vote.verified_at,
        zonkSong: zonkSong ? combineSongLine(zonkSong) : null,
      };
    }),
  };

  return <AdminRoundDetail round={round} songs={songs} summary={summary} />;
}
