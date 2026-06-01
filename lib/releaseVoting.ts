import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdminClient } from './supabaseAdmin';
import {
  buildLeaderboard,
  buildZonk,
  combineSongLine,
  type AdminParticipantRow,
  type AdminRoundSummary,
  type LeaderboardRow,
  type Round,
  type Song,
  type Vote,
  type VoteItem,
  type ZonkRow,
} from './releaseVotingShared';

export * from './releaseVotingShared';

export type RoundResults = {
  songs: Song[];
  votes: Vote[];
  items: VoteItem[];
  leaderboard: LeaderboardRow[];
  zonk: ZonkRow[];
  validVotes: number;
  songsCount: number;
};

export type AdminRoundDetailData = {
  round: Round;
  songs: Song[];
  summary: AdminRoundSummary;
};

export async function getCurrentRound() {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return null;

  const { data } = await sb
    .from('release_voting_rounds')
    .select('*')
    .eq('is_current', true)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as Round | null;
}

export async function getRoundBySlug(slug: string) {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return null;
  const { data } = await sb.from('release_voting_rounds').select('*').eq('slug', slug).maybeSingle();
  return data as Round | null;
}

export async function getRoundById(roundId: string) {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return null;
  const { data } = await sb.from('release_voting_rounds').select('*').eq('id', roundId).maybeSingle();
  return data as Round | null;
}

export async function listRounds() {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return [] as Round[];
  const { data } = await sb.from('release_voting_rounds').select('*').order('created_at', { ascending: false });
  return (data || []) as Round[];
}

export async function listPublicResultRounds() {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return [] as Round[];
  const { data } = await sb
    .from('release_voting_rounds')
    .select('*')
    .eq('is_public_results', true)
    .order('ends_at', { ascending: false })
    .order('created_at', { ascending: false });
  return (data || []) as Round[];
}

export async function getSongs(roundId: string) {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return [] as Song[];
  const { data } = await sb
    .from('release_voting_songs')
    .select('*')
    .eq('round_id', roundId)
    .order('sort_order')
    .order('created_at', { ascending: true });
  return (data || []) as Song[];
}

export async function getVerifiedVotes(roundId: string) {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return { votes: [] as Vote[], items: [] as VoteItem[] };

  const { data: votes } = await sb
    .from('release_voting_votes')
    .select('*')
    .eq('round_id', roundId)
    .eq('is_verified', true)
    .order('verified_at', { ascending: true });

  const ids = ((votes || []) as Vote[]).map((vote) => vote.id);
  const { data: items } = ids.length
    ? await sb.from('release_voting_vote_items').select('*').in('vote_id', ids)
    : { data: [] as VoteItem[] };

  return { votes: (votes || []) as Vote[], items: (items || []) as VoteItem[] };
}

export async function getAllVotes(roundId: string) {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return [] as Vote[];
  const { data } = await sb
    .from('release_voting_votes')
    .select('*')
    .eq('round_id', roundId)
    .order('created_at', { ascending: false });
  return (data || []) as Vote[];
}

export async function getRoundResults(roundId: string): Promise<RoundResults> {
  noStore();

  const songs = await getSongs(roundId);
  const { votes, items } = await getVerifiedVotes(roundId);
  const leaderboard = buildLeaderboard(songs, votes, items);
  const zonk = buildZonk(songs, votes);

  return {
    songs,
    votes,
    items,
    leaderboard,
    zonk,
    validVotes: votes.length,
    songsCount: songs.length,
  };
}

export async function getAdminRoundDetailData(roundId: string): Promise<AdminRoundDetailData | null> {
  noStore();

  const sb = getSupabaseAdminClient();
  if (!sb) return null;

  const round = await getRoundById(roundId);
  if (!round) return null;

  const songs = await getSongs(round.id);
  const votes = await getAllVotes(round.id);
  const voteIds = votes.map((vote) => vote.id);

  let items: VoteItem[] = [];
  if (voteIds.length) {
    const { data: itemData } = await sb.from('release_voting_vote_items').select('*').in('vote_id', voteIds);
    items = (itemData || []) as VoteItem[];
  }

  const verifiedVotes = votes.filter((vote) => vote.is_verified);
  const verifiedVoteIds = new Set(verifiedVotes.map((vote) => vote.id));
  const verifiedItems = items.filter((item) => verifiedVoteIds.has(item.vote_id));
  const songById = new Map(songs.map((song) => [song.id, song]));

  const participants: AdminParticipantRow[] = votes.map((vote) => {
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
  });

  const summary: AdminRoundSummary = {
    roundId: round.id,
    totalVotes: votes.length,
    verifiedVotes: verifiedVotes.length,
    pendingVotes: votes.length - verifiedVotes.length,
    songsCount: songs.length,
    leaderboard: buildLeaderboard(songs, verifiedVotes, verifiedItems),
    zonk: buildZonk(songs, verifiedVotes),
    participants,
  };

  return { round, songs, summary };
}
