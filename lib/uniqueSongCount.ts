import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { normalizedSongKey } from './releaseVotingShared';
import { databaseError } from './supabaseErrors';

const UNIQUE_SONG_PAGE_SIZE = 1000;

type SongIdentityRow = {
  title: string;
  artist: string | null;
};

/**
 * Zählt globale eindeutige Songs über alle Umfragen.
 *
 * Gleiches "Titel + Künstler" wird wochenübergreifend nur einmal gezählt.
 * normalizedSongKey vereinheitlicht u. a. Groß-/Kleinschreibung, Leerzeichen,
 * Satzzeichen und Umlaute, lässt aber Versionsangaben wie "Remix",
 * "Hüttenmix", "Radio Edit" usw. bewusst im Titel bestehen.
 *
 * is_active = null gilt bei Altdaten ebenfalls als aktiv.
 */
export async function getUniqueActiveSongCount() {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return 0;

  const uniqueKeys = new Set<string>();

  for (let from = 0; ; from += UNIQUE_SONG_PAGE_SIZE) {
    const { data, error } = await sb
      .from('release_voting_songs')
      .select('title,artist')
      .or('is_active.eq.true,is_active.is.null')
      .order('id', { ascending: true })
      .range(from, from + UNIQUE_SONG_PAGE_SIZE - 1);

    if (error) throw databaseError('Eindeutige Songs konnten nicht gezählt werden', error);

    const rows = (data || []) as SongIdentityRow[];
    for (const row of rows) {
      const key = normalizedSongKey(row);
      if (key && key !== '::') uniqueKeys.add(key);
    }

    if (rows.length < UNIQUE_SONG_PAGE_SIZE) break;
  }

  return uniqueKeys.size;
}
