import { getConfigState, getSupabaseAdminClient } from '@/lib/supabaseAdmin';

export type VoteItem = {
  song: string;
  points: number;
};

export type RoundRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: 'draft' | 'live' | 'ended';
  start_at: string;
  end_at: string;
  places_count: number;
  is_current: boolean;
  songs_json: string[];
  spotify_playlist_id: string | null;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
};

export type VoteRow = {
  id: string;
  round_id: string;
  juror_name: string | null;
  juror_email: string | null;
  juror_instagram: string | null;
  ranking_json: VoteItem[];
  zonk_song: string | null;
  created_at: string;
  updated_at: string;
  is_verified: boolean;
  verified_at: string | null;
  verify_token_hash: string | null;
  verify_expires_at: string | null;
  verification_sent_at: string | null;
};

export type LeaderboardRow = {
  rank: number;
  song: string;
  title: string;
  artist: string;
  totalPoints: number;
  voteCount: number;
  averagePoints: number;
};

export type ZonkRow = {
  rank: number;
  song: string;
  title: string;
  artist: string;
  count: number;
};

export type PublicRoundState = 'draft' | 'upcoming' | 'live' | 'ended';

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function parseSongList(raw: string) {
  const seen = new Set<string>();

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function mergeSongLists(existing: string[], additions: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const song of [...existing, ...additions]) {
    const normalized = String(song ?? '').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

export function splitSong(entry: string) {
  const normalized = entry.trim();
  const separatorMatch = normalized.match(/\s[–-]\s/);

  if (!separatorMatch) {
    return { full: normalized, title: normalized, artist: '—' };
  }

  const separator = separatorMatch[0];
  const [title, ...rest] = normalized.split(separator);

  return {
    full: normalized,
    title: title.trim(),
    artist: rest.join(separator).trim() || '—',
  };
}

export function combineSongLine(entry: string) {
  const parts = splitSong(entry);
  return parts.artist === '—' ? parts.title : `${parts.title} — ${parts.artist}`;
}

export function normalizeSpotifyPlaylistId(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const parts = url.pathname.split('/').filter(Boolean);
    const playlistIndex = parts.findIndex((part) => part === 'playlist');
    if (playlistIndex >= 0 && parts[playlistIndex + 1]) {
      return parts[playlistIndex + 1].trim();
    }
  } catch {
    // raw ID, not URL
  }

  return raw.replace(/^spotify:playlist:/, '').split('?')[0].trim();
}

export function createSpotifyEmbedUrl(playlistId: string | null | undefined) {
  const id = normalizeSpotifyPlaylistId(playlistId);
  if (!id) return '';
  return `https://open.spotify.com/embed/playlist/${encodeURIComponent(id)}?utm_source=generator&theme=0`;
}

export function normalizeDateTimeValue(value: string | null | undefined) {
  if (!value) return '';
  return value.trim().replace(' ', 'T').slice(0, 16);
}

export function formatDateTime(value: string | null | undefined) {
  const normalized = normalizeDateTimeValue(value);
  if (!normalized) return '—';

  const [datePart, timePart = '00:00'] = normalized.split('T');
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return value ?? '—';

  return `${day}.${month}.${year}, ${timePart}`;
}

export function statusLabel(status: RoundRow['status']) {
  if (status === 'live') return 'Live';
  if (status === 'ended') return 'Beendet';
  return 'Entwurf';
}

export function publicStatusLabel(state: PublicRoundState) {
  if (state === 'live') return 'Live';
  if (state === 'ended') return 'Beendet';
  if (state === 'upcoming') return 'Startet bald';
  return 'Entwurf';
}

export function createPublicRoundPath(slug: string) {
  return `/release-voting/${slug}`;
}

export function toDatetimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function createRoundDatePreset(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const isoDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const displayDate = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  const title = `Neue Songs der Woche ${displayDate}`;
  const slug = `neue-songs-${isoDate}`;
  return { title, slug, displayDate, isoDate };
}

export function getBerlinNowLocalValue() {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return formatter.format(new Date()).replace(' ', 'T');
}

export function getPublicRoundState(round: RoundRow | null | undefined): PublicRoundState {
  if (!round) return 'draft';
  if (round.status === 'ended') return 'ended';
  if (round.status === 'draft') return 'draft';

  const now = getBerlinNowLocalValue();
  const start = normalizeDateTimeValue(round.start_at);
  const end = normalizeDateTimeValue(round.end_at);

  if (start && now < start) return 'upcoming';
  if (end && now > end) return 'ended';
  return 'live';
}

export function shuffleSongs(songs: string[]) {
  const next = [...songs];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = temp;
  }
  return next;
}

export function filterVerifiedVotes(votes: VoteRow[] = []) {
  return votes.filter((vote) => vote.is_verified === true);
}

export function getVoteStats(votes: VoteRow[] = []) {
  const submitted = votes.length;
  const verified = votes.filter((vote) => vote.is_verified === true).length;
  return {
    submitted,
    verified,
    pending: submitted - verified,
  };
}

export function leaderboardFromVotes(songs: string[], votes: VoteRow[]): LeaderboardRow[] {
  const validVotes = Array.isArray(votes)
    ? votes.filter((vote) => Array.isArray(vote?.ranking_json))
    : [];

  const totalParticipants = validVotes.length;
  const map = new Map<string, { totalPoints: number; voteCount: number }>();

  songs.forEach((song) => {
    const normalizedSong = typeof song === 'string' ? song.trim() : '';
    if (!normalizedSong) return;
    map.set(normalizedSong, { totalPoints: 0, voteCount: 0 });
  });

  for (const vote of validVotes) {
    const ranking = Array.isArray(vote.ranking_json) ? vote.ranking_json : [];
    const seenInThisVote = new Set<string>();

    for (const item of ranking) {
      const song = typeof item.song === 'string' ? item.song.trim() : '';
      const points = Number(item.points);

      if (!song || !map.has(song) || !Number.isFinite(points)) continue;
      if (seenInThisVote.has(song)) continue;

      seenInThisVote.add(song);
      const current = map.get(song)!;
      current.totalPoints += points;
      if (points > 0) current.voteCount += 1;
    }
  }

  return Array.from(map.entries())
    .map(([song, value]) => {
      const parts = splitSong(song);
      return {
        song,
        title: parts.title,
        artist: parts.artist,
        totalPoints: value.totalPoints,
        voteCount: value.voteCount,
        averagePoints:
          totalParticipants > 0
            ? Number((value.totalPoints / totalParticipants).toFixed(2))
            : 0,
      };
    })
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      return a.song.localeCompare(b.song, 'de');
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function zonkLeaderboardFromVotes(songs: string[], votes: VoteRow[]): ZonkRow[] {
  const validSongs = new Set(songs.map((song) => String(song).trim()).filter(Boolean));
  const map = new Map<string, number>();

  for (const vote of votes) {
    const zonk = String(vote.zonk_song ?? '').trim();
    if (!zonk || !validSongs.has(zonk)) continue;
    map.set(zonk, (map.get(zonk) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([song, count]) => {
      const parts = splitSong(song);
      return { song, title: parts.title, artist: parts.artist, count };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.song.localeCompare(b.song, 'de');
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function listRounds(limit = 100) {
  const configState = getConfigState();
  if (!configState.ok) return { data: [] as RoundRow[], error: configState.message };

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { data: [] as RoundRow[], error: 'Supabase-Client konnte nicht erstellt werden.' };

  const { data, error } = await supabase
    .from('release_voting_rounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [] as RoundRow[], error: error.message };
  return { data: (data ?? []) as RoundRow[], error: null as string | null };
}

export async function getCurrentRound() {
  const configState = getConfigState();
  if (!configState.ok) return { data: null as RoundRow | null, error: configState.message };

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { data: null as RoundRow | null, error: 'Supabase-Client konnte nicht erstellt werden.' };

  const first = await supabase
    .from('release_voting_rounds')
    .select('*')
    .eq('is_current', true)
    .maybeSingle();

  if (first.error) return { data: null as RoundRow | null, error: first.error.message };
  if (first.data) return { data: first.data as RoundRow, error: null as string | null };

  const second = await supabase
    .from('release_voting_rounds')
    .select('*')
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (second.error) return { data: null as RoundRow | null, error: second.error.message };
  return { data: (second.data as RoundRow | null) ?? null, error: null as string | null };
}

export async function getRoundBySlug(slug: string) {
  const configState = getConfigState();
  if (!configState.ok) return { data: null as RoundRow | null, error: configState.message };

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { data: null as RoundRow | null, error: 'Supabase-Client konnte nicht erstellt werden.' };

  const { data, error } = await supabase
    .from('release_voting_rounds')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) return { data: null as RoundRow | null, error: error.message };
  return { data: (data as RoundRow | null) ?? null, error: null as string | null };
}

export async function getVotesForRound(roundId: string) {
  const configState = getConfigState();
  if (!configState.ok) return { data: [] as VoteRow[], error: configState.message };

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { data: [] as VoteRow[], error: 'Supabase-Client konnte nicht erstellt werden.' };

  const { data, error } = await supabase
    .from('release_voting_votes')
    .select('*')
    .eq('round_id', roundId)
    .order('created_at', { ascending: false });

  if (error) return { data: [] as VoteRow[], error: error.message };
  return { data: (data ?? []) as VoteRow[], error: null as string | null };
}

export type ImprintSettings = {
  content: string;
  updated_at: string | null;
};

export const DEFAULT_IMPRINT_CONTENT = `Impressum

Angaben gemäß § 5 TMG

[Name / Unternehmen]
[Straße und Hausnummer]
[PLZ Ort]
Deutschland

Kontakt
E-Mail: voting@knallhart-serviert.de

Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
[Name]
[Adresse]

Hinweis: Bitte diese Angaben im Admin-Bereich vollständig und rechtssicher ausfüllen.`;

export async function getImprintSettings() {
  const configState = getConfigState();
  if (!configState.ok) {
    return {
      data: { content: DEFAULT_IMPRINT_CONTENT, updated_at: null } as ImprintSettings,
      error: configState.message,
    };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      data: { content: DEFAULT_IMPRINT_CONTENT, updated_at: null } as ImprintSettings,
      error: 'Supabase-Client konnte nicht erstellt werden.',
    };
  }

  const { data, error } = await supabase
    .from('app_settings')
    .select('value_json, updated_at')
    .eq('key', 'imprint')
    .maybeSingle();

  if (error) {
    return {
      data: { content: DEFAULT_IMPRINT_CONTENT, updated_at: null } as ImprintSettings,
      error: error.message,
    };
  }

  const value = data?.value_json as { content?: string } | null;
  return {
    data: {
      content: typeof value?.content === 'string' && value.content.trim() ? value.content : DEFAULT_IMPRINT_CONTENT,
      updated_at: typeof data?.updated_at === 'string' ? data.updated_at : null,
    } as ImprintSettings,
    error: null as string | null,
  };
}
