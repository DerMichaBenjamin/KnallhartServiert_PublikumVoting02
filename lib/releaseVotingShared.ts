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

export type SongDuplicateGroup = {
  key: string;
  kind: 'exact' | 'possible';
  songs: Song[];
};

export type AdminParticipantRow = {
  voteId: string;
  name: string;
  email: string;
  instagram: string | null;
  isVerified: boolean;
  votedAt: string;
  verifiedAt: string | null;
  zonkSong: string | null;
};

export type AdminRoundSummary = {
  roundId: string;
  totalVotes: number;
  verifiedVotes: number;
  pendingVotes: number;
  songsCount: number;
  leaderboard: LeaderboardRow[];
  zonk: ZonkRow[];
  participants: AdminParticipantRow[];
};

function stripDiacritics(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeSongPartStrict(value?: string | null) {
  return stripDiacritics(String(value || ''))
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/&/g, 'und')
    .replace(/['’`´]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function normalizeSongPartLoose(value?: string | null) {
  return normalizeSongPartStrict(
    String(value || '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\b(radio|single|extended|club|party|festival|malle|mallorca|apres|après|ski|mix|edit|version|remix|remaster|remastered|live|karaoke|instrumental)\b/gi, ' ')
      .replace(/\bfeat\.?\b|\bft\.?\b|\bfeaturing\b/gi, ' ')
  );
}

export function normalizedSongKey(song: { title: string; artist?: string | null }) {
  return `${normalizeSongPartStrict(song.title)}::${normalizeSongPartStrict(song.artist || '')}`;
}

function looseSongKey(song: { title: string; artist?: string | null }) {
  return `${normalizeSongPartLoose(song.title)}::${normalizeSongPartLoose(song.artist || '')}`;
}

function groupSongsByKey(songs: Song[], keyFn: (song: Song) => string) {
  const grouped = new Map<string, Song[]>();

  for (const song of songs) {
    const key = keyFn(song);
    if (!key || key === '::') continue;
    const current = grouped.get(key) || [];
    current.push(song);
    grouped.set(key, current);
  }

  return grouped;
}

export function findSongDuplicateGroups(songs: Song[]): SongDuplicateGroup[] {
  const exactGroups: SongDuplicateGroup[] = [];
  const exactKeysInGroups = new Set<string>();
  const exactByKey = groupSongsByKey(songs, normalizedSongKey);

  for (const [key, group] of exactByKey.entries()) {
    if (group.length > 1) {
      exactKeysInGroups.add(key);
      exactGroups.push({
        key,
        kind: 'exact',
        songs: [...group].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)),
      });
    }
  }

  const possibleGroups: SongDuplicateGroup[] = [];
  const looseByKey = groupSongsByKey(songs, looseSongKey);

  for (const [key, group] of looseByKey.entries()) {
    if (group.length < 2) continue;

    const uniqueExactKeys = new Set(group.map(normalizedSongKey));
    if (uniqueExactKeys.size < 2) continue;

    const isOnlyExactDuplicateGroup = [...uniqueExactKeys].every((exactKey) => exactKeysInGroups.has(exactKey));
    if (isOnlyExactDuplicateGroup) continue;

    possibleGroups.push({
      key,
      kind: 'possible',
      songs: [...group].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)),
    });
  }

  return [...exactGroups, ...possibleGroups].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'exact' ? -1 : 1;
    return a.songs[0]?.title.localeCompare(b.songs[0]?.title || '') || 0;
  });
}

export function formatDuplicateSongMessage(groups: SongDuplicateGroup[]) {
  const exact = groups.filter((group) => group.kind === 'exact');
  if (!exact.length) return '';

  return [
    'Doppelte Songs gefunden. Bitte bereinige die Songliste vor dem Speichern:',
    ...exact.slice(0, 8).map((group) => `- ${group.songs.map(combineSongLine).join(' / ')}`),
    exact.length > 8 ? `- plus ${exact.length - 8} weitere Doppler` : '',
  ].filter(Boolean).join('\n');
}

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

  const validVotesCount = validVoteIds.size;

  const rows = [...rowsBySongId.values()].map((row) => ({
    ...row,
    avg: validVotesCount ? row.total / validVotesCount : 0,
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
