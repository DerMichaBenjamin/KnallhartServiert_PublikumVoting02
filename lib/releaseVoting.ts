import { getSupabaseAdminClient } from './supabaseAdmin';

export type Round = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  places_count: number;
  is_current: boolean;
  is_public_results: boolean;
  spotify_playlist_id: string | null;
  created_at: string;
};

export type Song = {
  id: string;
  round_id: string;
  title: string;
  artist: string;
  sort_order: number;
};

export type Vote = {
  id: string;
  round_id: string;
  juror_name: string;
  juror_email: string;
  juror_instagram: string | null;
  is_verified: boolean;
  verified_at: string | null;
  zonk_song_id: string | null;
  created_at: string;
};

export type VoteItem = {
  vote_id: string;
  song_id: string;
  points: number;
};

export type LeaderboardRow = {
  song: Song;
  total: number;
  count: number;
  avg: number;
};

export type ZonkRow = {
  song: Song;
  count: number;
};

export type AdminRoundSummary = {
  roundId: string;
  totalVotes: number;
  verifiedVotes: number;
  pendingVotes: number;
  songsCount: number;
  leaderboard: LeaderboardRow[];
  zonk: ZonkRow[];
};

export function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function parseSongList(text: string) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(' - ');
      if (parts.length >= 2) return { title: parts[0].trim(), artist: parts.slice(1).join(' - ').trim() };
      return { title: line, artist: '' };
    });
}

export function combineSongLine(song: { title: string; artist: string } | string) {
  if (typeof song === 'string') return song;
  return song.artist ? `${song.title} — ${song.artist}` : song.title;
}

export function spotifyIdFromInput(input?: string | null) {
  const value = (input || '').trim();
  if (!value) return '';
  const m = value.match(/playlist\/([A-Za-z0-9]+)/);
  if (m?.[1]) return m[1];
  return value.split('?')[0].trim();
}

export async function getCurrentRound() {
  const sb = getSupabaseAdminClient();
  if (!sb) return null;
  const { data } = await sb
    .from('release_voting_rounds')
    .select('*')
    .eq('is_current', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as Round | null;
}

export async function getRoundBySlug(slug: string) {
  const sb = getSupabaseAdminClient();
  if (!sb) return null;
  const { data } = await sb.from('release_voting_rounds').select('*').eq('slug', slug).maybeSingle();
  return data as Round | null;
}

export async function listRounds() {
  const sb = getSupabaseAdminClient();
  if (!sb) return [] as Round[];
  const { data } = await sb.from('release_voting_rounds').select('*').order('created_at', { ascending: false });
  return (data || []) as Round[];
}

export async function listPublicResultRounds() {
  const sb = getSupabaseAdminClient();
  if (!sb) return [] as Round[];
  const { data } = await sb.from('release_voting_rounds').select('*').eq('is_public_results', true).order('ends_at', { ascending: false });
  return (data || []) as Round[];
}

export async function getSongs(roundId: string) {
  const sb = getSupabaseAdminClient();
  if (!sb) return [] as Song[];
  const { data } = await sb.from('release_voting_songs').select('*').eq('round_id', roundId).order('sort_order');
  return (data || []) as Song[];
}

export async function getVerifiedVotes(roundId: string) {
  const sb = getSupabaseAdminClient();
  if (!sb) return { votes: [] as Vote[], items: [] as VoteItem[] };
  const { data: votes } = await sb.from('release_voting_votes').select('*').eq('round_id', roundId).eq('is_verified', true);
  const ids = ((votes || []) as Vote[]).map((vote) => vote.id);
  const { data: items } = ids.length
    ? await sb.from('release_voting_vote_items').select('*').in('vote_id', ids)
    : { data: [] as VoteItem[] };
  return { votes: (votes || []) as Vote[], items: (items || []) as VoteItem[] };
}

export async function getAllVotes(roundId: string) {
  const sb = getSupabaseAdminClient();
  if (!sb) return [] as Vote[];
  const { data } = await sb.from('release_voting_votes').select('*').eq('round_id', roundId).order('created_at', { ascending: false });
  return (data || []) as Vote[];
}

export function buildLeaderboard(songs: Song[], votes: Vote[], items: VoteItem[]): LeaderboardRow[] {
  const validVoteIds = new Set(votes.filter((vote) => vote.is_verified).map((vote) => vote.id));
  const rowsBySongId = new Map<string, LeaderboardRow>(
    songs.map((song) => [song.id, { song, total: 0, count: 0, avg: 0 }])
  );

  for (const item of items) {
    if (!validVoteIds.has(item.vote_id)) continue;
    const row = rowsBySongId.get(item.song_id);
    if (!row) continue;

    const points = Number(item.points);
    if (!Number.isFinite(points)) continue;

    row.total += points;
    row.count += 1;
  }

  const rows = [...rowsBySongId.values()].map((row) => ({
    ...row,
    avg: row.count ? row.total / row.count : 0,
  }));

  rows.sort((a, b) => b.total - a.total || b.avg - a.avg || b.count - a.count || a.song.title.localeCompare(b.song.title));
  return rows;
}

export function buildZonk(songs: Song[], votes: Vote[]): ZonkRow[] {
  const counts = new Map<string, number>();

  votes
    .filter((vote) => vote.is_verified)
    .forEach((vote) => {
      if (vote.zonk_song_id) counts.set(vote.zonk_song_id, (counts.get(vote.zonk_song_id) || 0) + 1);
    });

  return songs
    .map((song) => ({ song, count: counts.get(song.id) || 0 }))
    .sort((a, b) => b.count - a.count || a.song.title.localeCompare(b.song.title));
}
