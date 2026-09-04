export const JURY_PLACES_COUNT = 12;

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
  jury_voting_closed: boolean;
  jury_voting_ends_at: string | null;
  created_at: string;
};

export type Song = {
  id: string;
  round_id: string;
  title: string;
  artist: string;
  sort_order: number;
  /** Fehlend/null in Altdaten bedeutet weiterhin aktiv. */
  is_active?: boolean | null;
};

export function isSongActive(song: Pick<Song, 'is_active'>) {
  return song.is_active !== false;
}

export type Vote = {
  id: string;
  round_id: string;
  voting_channel: 'audience' | 'dj';
  juror_name: string;
  juror_email: string;
  juror_instagram: string | null;
  is_verified: boolean;
  verified_at: string | null;
  is_counted: boolean;
  integrity_status: 'clear' | 'review' | 'approved' | 'excluded';
  integrity_reasons: string[] | null;
  email_domain: string | null;
  ip_hash: string | null;
  ranking_hash: string | null;
  integrity_updated_at: string | null;
  moderated_at: string | null;
  zonk_song_id: string | null;
  created_at: string;
};

export type VoteItem = {
  vote_id: string;
  song_id: string;
  points: number;
};

export type AudienceRatingStats = {
  ratingCount: number;
  sum: number;
  sumSquares: number;
  minimum: number | null;
  maximum: number | null;
  topRatings: number;
  zeroRatings: number;
  distribution: number[];
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
  isCounted: boolean;
  integrityStatus: 'clear' | 'review' | 'approved' | 'excluded';
  integrityReasons: string[];
  emailDomain: string | null;
  ipHash: string | null;
  sameIpVotes: number;
  votedAt: string;
  verifiedAt: string | null;
  zonkSong: string | null;
};

export type AdminRoundSummary = {
  roundId: string;
  totalVotes: number;
  confirmedVotes: number;
  countedVotes: number;
  reviewVotes: number;
  excludedVotes: number;
  unverifiedVotes: number;
  /** Legacy alias used by older UI pieces: equals countedVotes. */
  verifiedVotes: number;
  /** Legacy alias used by older UI pieces: equals unverifiedVotes. */
  pendingVotes: number;
  songsCount: number;
  leaderboard: LeaderboardRow[];
  zonk: ZonkRow[];
  participants: AdminParticipantRow[];
  /** Kompakte Rohwert-Aggregate je Song; verändert die Ergebniswertung nicht. */
  audienceRatingStatsBySong?: Record<string, AudienceRatingStats>;
};

/**
 * Verdichtet die Einzelwertungen des Publikums ohne große Item-Arrays an die UI
 * weiterzureichen. Ein nicht platzierter Song zählt pro gewerteter Stimme mit 0.
 * Mehrfachzeilen desselben Vote/Song-Paars werden defensiv nur einmal gezählt.
 */
export function buildAudienceRatingStats(
  songs: Song[],
  countedVotes: number,
  items: VoteItem[],
): Record<string, AudienceRatingStats> {
  const activeSongs = songs.filter(isSongActive);
  const safeVoteCount = Math.max(0, Math.floor(countedVotes));
  const result: Record<string, AudienceRatingStats> = {};
  for (const song of activeSongs) {
    const distribution = Array.from({ length: JURY_PLACES_COUNT + 1 }, () => 0);
    distribution[0] = safeVoteCount;
    result[song.id] = {
      ratingCount: safeVoteCount,
      sum: 0,
      sumSquares: 0,
      minimum: safeVoteCount ? 0 : null,
      maximum: safeVoteCount ? 0 : null,
      topRatings: 0,
      zeroRatings: safeVoteCount,
      distribution,
    };
  }

  const uniqueItems = new Map<string, VoteItem>();
  for (const item of items) uniqueItems.set(`${item.vote_id}\u0000${item.song_id}`, item);
  for (const item of uniqueItems.values()) {
    const stats = result[item.song_id];
    const points = Number(item.points);
    if (!stats || !Number.isInteger(points) || points < 1 || points > JURY_PLACES_COUNT || stats.zeroRatings <= 0) continue;
    stats.sum += points;
    stats.sumSquares += points ** 2;
    stats.maximum = Math.max(stats.maximum || 0, points);
    stats.topRatings += points === JURY_PLACES_COUNT ? 1 : 0;
    stats.zeroRatings -= 1;
    stats.distribution[0] = stats.zeroRatings;
    stats.distribution[points] += 1;
  }

  for (const stats of Object.values(result)) {
    if (!stats.ratingCount) continue;
    const firstPositive = stats.distribution.findIndex((count, points) => points > 0 && count > 0);
    stats.minimum = stats.zeroRatings > 0 ? 0 : firstPositive >= 1 ? firstPositive : 0;
  }
  return result;
}

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

/**
 * Akzeptiert die in kopierten Spotify-, Excel- und Messenger-Listen üblichen
 * Strichvarianten. Beim normalen ASCII-Bindestrich muss mindestens auf einer
 * Seite Leerraum stehen, damit Wörter wie "Après-Ski" nicht getrennt werden.
 * Typografische Striche sind auch ohne Leerraum ein eindeutiger Listentrenner.
 *
 * Der letzte passende Trenner wird verwendet. Dadurch bleibt beispielsweise
 * "Titel - Remix – Künstler" vollständig als Titel erhalten.
 */
export function splitSongLine(value: string) {
  const line = String(value || '').trim();
  const separators = [...line.matchAll(/(?:\s+-\s*|\s*-\s+|[‐‑‒–—―−﹘﹣－])/gu)];
  const separator = separators
    .reverse()
    .find((match) => match.index != null
      && match.index > 0
      && match.index + match[0].length < line.length);
  if (!separator || separator.index == null) return { title: line, artist: '' };
  const artistStart = separator.index + separator[0].length;
  return {
    title: line.slice(0, separator.index).trim(),
    artist: line.slice(artistStart).trim(),
  };
}

function canonicalSongParts(song: { title: string; artist?: string | null }) {
  const title = String(song.title || '').trim();
  const artist = String(song.artist || '').trim();
  // Repariert auch den Vergleich bereits falsch importierter Zeilen, bei denen
  // "Titel – Künstler" vollständig im Titelfeld und das Künstlerfeld leer ist.
  if (!artist) {
    const parsed = splitSongLine(title);
    if (parsed.artist) return parsed;
  }
  return { title, artist };
}

export function normalizedSongKey(song: { title: string; artist?: string | null }) {
  const canonical = canonicalSongParts(song);
  return `${normalizeSongPartStrict(canonical.title)}::${normalizeSongPartStrict(canonical.artist)}`;
}

function looseSongKey(song: { title: string; artist?: string | null }) {
  const canonical = canonicalSongParts(song);
  return `${normalizeSongPartLoose(canonical.title)}::${normalizeSongPartLoose(canonical.artist)}`;
}

function artistCreditKeys(song: { title: string; artist?: string | null }) {
  const artist = canonicalSongParts(song).artist
    .replace(/\b(radio|single|extended|club|party|festival|malle|mallorca|apres|après|ski|mix|edit|version|remix|remaster|remastered|live|karaoke|instrumental)\b/gi, ' ');
  const credits = artist
    .split(/\s*(?:,|;|\/|\||&|\+|\b(?:feat(?:uring)?|ft)\.?\b|\b[x×]\b)\s*/i)
    .map(normalizeSongPartStrict)
    .filter(Boolean);
  return new Set(credits.length ? credits : [normalizeSongPartStrict(artist)].filter(Boolean));
}

function editDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + Number(left[leftIndex - 1] !== right[rightIndex - 1]),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

/**
 * Erkennt neben identischen Datensätzen auch sehr klare Metadatenvarianten:
 * unterschiedliche Künstlertrenner/-reihenfolge, zusätzliche Feature-Credits,
 * Versionszusätze sowie einen einzelnen Tippfehler bei ausreichend langen Titeln.
 * Ohne mindestens einen gemeinsamen Künstler wird nie automatisch zusammengeführt.
 */
export function areSongsDefiniteDuplicates(
  left: { title: string; artist?: string | null },
  right: { title: string; artist?: string | null },
) {
  if (normalizedSongKey(left) === normalizedSongKey(right)) return true;
  const leftParts = canonicalSongParts(left);
  const rightParts = canonicalSongParts(right);
  const leftTitle = normalizeSongPartStrict(leftParts.title);
  const rightTitle = normalizeSongPartStrict(rightParts.title);
  if (!leftTitle || !rightTitle) return false;

  const leftArtists = artistCreditKeys(left);
  const rightArtists = artistCreditKeys(right);
  const sharedArtists = [...leftArtists].filter((artist) => rightArtists.has(artist)).length;
  if (!sharedArtists) return false;
  const artistCoverage = sharedArtists / Math.max(1, Math.min(leftArtists.size, rightArtists.size));

  if (leftTitle === rightTitle) return true;
  const leftLooseTitle = normalizeSongPartLoose(leftParts.title);
  const rightLooseTitle = normalizeSongPartLoose(rightParts.title);
  if (leftLooseTitle && leftLooseTitle === rightLooseTitle && artistCoverage >= 0.5) return true;

  const longestTitle = Math.max(leftLooseTitle.length, rightLooseTitle.length);
  if (longestTitle < 8 || artistCoverage < 0.5) return false;
  const titleSimilarity = 1 - editDistance(leftLooseTitle, rightLooseTitle) / longestTitle;
  return titleSimilarity >= 0.9;
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
  const candidateSongs = songs.filter(isSongActive);
  const parent = new Map(candidateSongs.map((song) => [song.id, song.id]));
  const find = (id: string): string => {
    const current = parent.get(id) || id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  for (let leftIndex = 0; leftIndex < candidateSongs.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < candidateSongs.length; rightIndex += 1) {
      if (areSongsDefiniteDuplicates(candidateSongs[leftIndex], candidateSongs[rightIndex])) union(candidateSongs[leftIndex].id, candidateSongs[rightIndex].id);
    }
  }

  const definiteByRoot = new Map<string, Song[]>();
  for (const song of candidateSongs) {
    const root = find(song.id);
    definiteByRoot.set(root, [...(definiteByRoot.get(root) || []), song]);
  }
  const exactGroups = [...definiteByRoot.values()].filter((group) => group.length > 1).map((group) => ({
    key: `exact:${group.map((song) => song.id).sort().join(':')}`,
    kind: 'exact' as const,
    songs: [...group].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title)),
  }));
  const exactSongIds = new Set(exactGroups.flatMap((group) => group.songs.map((song) => song.id)));

  const possibleGroups: SongDuplicateGroup[] = [];
  const looseByKey = groupSongsByKey(candidateSongs.filter((song) => !exactSongIds.has(song.id)), looseSongKey);

  for (const [key, group] of looseByKey.entries()) {
    if (group.length < 2) continue;

    const uniqueExactKeys = new Set(group.map(normalizedSongKey));
    if (uniqueExactKeys.size < 2) continue;

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
    .map(splitSongLine);
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

export function buildLeaderboard(
  songs: Song[],
  votes: Array<{ id: string; is_verified: boolean; is_counted: boolean | null | undefined }>,
  items: VoteItem[],
): LeaderboardRow[] {
  const activeSongs = songs.filter(isSongActive);
  const validVoteIds = new Set(votes.filter((vote) => vote.is_verified && vote.is_counted !== false).map((vote) => vote.id));
  const validVotesCount = validVoteIds.size;
  const songIds = new Set(activeSongs.map((song) => song.id));
  const rowsBySongId = new Map<string, LeaderboardRow>(
    activeSongs.map((song) => [song.id, { song, total: 0, count: 0, avg: 0 }])
  );

  // Important after manual merges: count every song only once per verified vote.
  // If an older merge left duplicate vote_items for the same vote/song, keep the highest points.
  // Also ignore all items from unverified votes and all items pointing to songs outside this round.
  const bestItemByVoteAndSong = new Map<string, VoteItem>();

  for (const item of items) {
    if (!validVoteIds.has(item.vote_id)) continue;
    if (!songIds.has(item.song_id)) continue;

    const points = Number(item.points);
    if (!Number.isFinite(points)) continue;

    const key = `${item.vote_id}::${item.song_id}`;
    const existing = bestItemByVoteAndSong.get(key);

    if (!existing || Number(existing.points) < points) {
      bestItemByVoteAndSong.set(key, {
        vote_id: item.vote_id,
        song_id: item.song_id,
        points,
      });
    }
  }

  for (const item of bestItemByVoteAndSong.values()) {
    const row = rowsBySongId.get(item.song_id);
    if (!row) continue;

    row.total += Number(item.points);
    row.count += 1;
  }

  const rows = [...rowsBySongId.values()].map((row) => ({
    ...row,
    avg: validVotesCount ? row.total / validVotesCount : 0,
  }));

  rows.sort((a, b) => b.total - a.total || b.avg - a.avg || b.count - a.count || a.song.title.localeCompare(b.song.title));
  return rows;
}

export function buildZonk(
  songs: Song[],
  votes: Array<{ is_verified: boolean; is_counted: boolean | null | undefined; zonk_song_id: string | null }>,
): ZonkRow[] {
  const activeSongs = songs.filter(isSongActive);
  const counts = new Map<string, number>();
  const songIds = new Set(activeSongs.map((song) => song.id));

  votes
    .filter((vote) => vote.is_verified && vote.is_counted !== false)
    .forEach((vote) => {
      if (vote.zonk_song_id && songIds.has(vote.zonk_song_id)) {
        counts.set(vote.zonk_song_id, (counts.get(vote.zonk_song_id) || 0) + 1);
      }
    });

  return activeSongs
    .map((song) => ({ song, count: counts.get(song.id) || 0 }))
    .sort((a, b) => b.count - a.count || a.song.title.localeCompare(b.song.title));
}
