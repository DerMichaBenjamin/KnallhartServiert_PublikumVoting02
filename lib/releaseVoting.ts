import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { getSetting, setSetting } from './settings';
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

export type RoundVoteCounts = {
  totalVotes: number;
  confirmedVotes: number;
  countedVotes: number;
  reviewVotes: number;
  excludedVotes: number;
  unverifiedVotes: number;
};

type AdminRoundDetailOptions = {
  includeParticipants?: boolean;
  round?: Round;
};

const DATABASE_PAGE_SIZE = 1000;
const VOTE_ITEM_ID_CHUNK = 75;

const CURRENT_DJ_ROUND_SETTING = 'current_dj_round_id';

export async function getCurrentDjRoundId() {
  noStore();
  const value = await getSetting(CURRENT_DJ_ROUND_SETTING, '');
  const roundId = String(value || '').trim();
  return roundId || null;
}

export async function setCurrentDjRoundId(roundId: string | null) {
  await setSetting(CURRENT_DJ_ROUND_SETTING, roundId || '');
}

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

export async function getCurrentDjRound() {
  noStore();
  const roundId = await getCurrentDjRoundId();
  if (!roundId) return null;
  return getRoundById(roundId);
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

  const votes: Vote[] = [];
  for (let from = 0; ; from += DATABASE_PAGE_SIZE) {
    const { data, error } = await sb
      .from('release_voting_votes')
      .select('*')
      .eq('round_id', roundId)
      .eq('is_verified', true)
      .eq('is_counted', true)
      .order('verified_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + DATABASE_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as Vote[];
    votes.push(...page);
    if (page.length < DATABASE_PAGE_SIZE) break;
  }

  const items = await getVoteItemsForVoteIds(votes.map((vote) => vote.id));
  return { votes, items };
}

export async function getAllVotes(roundId: string) {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return [] as Vote[];

  const votes: Vote[] = [];
  for (let from = 0; ; from += DATABASE_PAGE_SIZE) {
    const { data, error } = await sb
      .from('release_voting_votes')
      .select('*')
      .eq('round_id', roundId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + DATABASE_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as Vote[];
    votes.push(...page);
    if (page.length < DATABASE_PAGE_SIZE) break;
  }
  return votes;
}

async function getVoteItemsForVoteIds(voteIds: string[]) {
  const sb = getSupabaseAdminClient();
  if (!sb || !voteIds.length) return [] as VoteItem[];

  const items: VoteItem[] = [];
  const chunks: string[][] = [];
  for (let index = 0; index < voteIds.length; index += VOTE_ITEM_ID_CHUNK) {
    chunks.push(voteIds.slice(index, index + VOTE_ITEM_ID_CHUNK));
  }

  for (let index = 0; index < chunks.length; index += 10) {
    const batch = await Promise.all(
      chunks.slice(index, index + 10).map((ids) =>
        sb.from('release_voting_vote_items').select('*').in('vote_id', ids)
      )
    );
    for (const result of batch) {
      if (result.error) throw result.error;
      items.push(...((result.data || []) as VoteItem[]));
    }
  }

  return items;
}

function exactCount(result: { count: number | null; error: unknown }, label: string) {
  if (result.error) throw new Error(`${label} konnten nicht gezählt werden.`);
  return result.count || 0;
}

export async function getRoundVoteCounts(roundId: string): Promise<RoundVoteCounts> {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return { totalVotes: 0, confirmedVotes: 0, countedVotes: 0, reviewVotes: 0, excludedVotes: 0, unverifiedVotes: 0 };

  const [total, confirmed, counted, review, excluded] = await Promise.all([
    sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('round_id', roundId),
    sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('round_id', roundId).eq('is_verified', true),
    sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('round_id', roundId).eq('is_verified', true).or('is_counted.eq.true,is_counted.is.null'),
    sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('round_id', roundId).eq('is_verified', true).eq('is_counted', false).or('integrity_status.neq.excluded,integrity_status.is.null'),
    sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('round_id', roundId).eq('is_verified', true).eq('integrity_status', 'excluded'),
  ]);

  const totalVotes = exactCount(total, 'Publikumsstimmen');
  const confirmedVotes = exactCount(confirmed, 'Bestätigte Stimmen');
  return {
    totalVotes,
    confirmedVotes,
    countedVotes: exactCount(counted, 'Gewertete Stimmen'),
    reviewVotes: exactCount(review, 'Stimmen in Prüfung'),
    excludedVotes: exactCount(excluded, 'Ausgeschlossene Stimmen'),
    unverifiedVotes: Math.max(0, totalVotes - confirmedVotes),
  };
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

export async function getAdminRoundDetailData(roundId: string, options: AdminRoundDetailOptions = {}): Promise<AdminRoundDetailData | null> {
  noStore();

  const round = options.round || await getRoundById(roundId);
  if (!round) return null;

  const songsPromise = getSongs(round.id);
  const votesPromise = options.includeParticipants ? getAllVotes(round.id) : Promise.resolve(null);
  const verifiedPromise = options.includeParticipants ? Promise.resolve(null) : getVerifiedVotes(round.id);
  const countsPromise = options.includeParticipants ? Promise.resolve(null) : getRoundVoteCounts(round.id);
  const [songs, allVotes, verifiedData, exactCounts] = await Promise.all([songsPromise, votesPromise, verifiedPromise, countsPromise]);

  const countedVoteRows = allVotes
    ? allVotes.filter((vote) => Boolean(vote.is_verified) && vote.is_counted === true)
    : verifiedData?.votes || [];
  const items = allVotes
    ? await getVoteItemsForVoteIds(countedVoteRows.map((vote) => vote.id))
    : verifiedData?.items || [];
  const leaderboard = buildLeaderboard(songs, countedVoteRows, items);
  const zonk = buildZonk(songs, countedVoteRows);
  const songById = new Map(songs.map((song) => [song.id, song]));
  const sameIpCounts = new Map<string, number>();

  for (const vote of allVotes || []) {
    if (!vote.ip_hash) continue;
    sameIpCounts.set(vote.ip_hash, (sameIpCounts.get(vote.ip_hash) || 0) + 1);
  }

  const participants: AdminParticipantRow[] = (allVotes || []).map((vote) => {
    const zonkSong = vote.zonk_song_id ? songById.get(vote.zonk_song_id) : null;
    const integrityStatus = (vote.integrity_status || (vote.is_counted === false ? 'review' : 'clear')) as AdminParticipantRow['integrityStatus'];

    return {
      voteId: vote.id,
      name: vote.juror_name || '',
      email: vote.juror_email || '',
      instagram: vote.juror_instagram || null,
      isVerified: Boolean(vote.is_verified),
      isCounted: Boolean(vote.is_verified && vote.is_counted !== false),
      integrityStatus,
      integrityReasons: Array.isArray(vote.integrity_reasons) ? vote.integrity_reasons.filter(Boolean) : [],
      emailDomain: vote.email_domain || null,
      ipHash: vote.ip_hash || null,
      sameIpVotes: vote.ip_hash ? (sameIpCounts.get(vote.ip_hash) || 1) : 0,
      votedAt: vote.created_at,
      verifiedAt: vote.verified_at,
      zonkSong: zonkSong ? combineSongLine(zonkSong) : null,
    };
  });

  const counts = exactCounts || (() => {
    const source = allVotes || [];
    const confirmedVotes = source.filter((vote) => Boolean(vote.is_verified)).length;
    return {
      totalVotes: source.length,
      confirmedVotes,
      countedVotes: source.filter((vote) => Boolean(vote.is_verified) && vote.is_counted !== false).length,
      excludedVotes: source.filter((vote) => Boolean(vote.is_verified) && vote.integrity_status === 'excluded').length,
      reviewVotes: source.filter((vote) => Boolean(vote.is_verified) && vote.is_counted === false && vote.integrity_status !== 'excluded').length,
      unverifiedVotes: source.length - confirmedVotes,
    };
  })();

  const summary: AdminRoundSummary = {
    roundId: round.id,
    ...counts,
    verifiedVotes: counts.countedVotes,
    pendingVotes: counts.unverifiedVotes,
    songsCount: songs.length,
    leaderboard,
    zonk,
    participants,
  };

  return { round, songs, summary };
}

export async function getAdminDashboardRoundData(round: Round) {
  return getAdminRoundDetailData(round.id, { round, includeParticipants: false });
}
