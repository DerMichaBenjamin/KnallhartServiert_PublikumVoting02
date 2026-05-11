import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { combineSongLine, findSongDuplicateGroups, formatDuplicateSongMessage, normalizedSongKey, parseSongList, type Song } from '@/lib/releaseVoting';

function dbMessage(error: unknown) {
  if (!error) return 'Unbekannter Fehler.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error) {
    const e = error as Record<string, unknown>;
    return [e.message, e.details, e.hint, e.code].filter(Boolean).map(String).join(' | ');
  }
  return String(error);
}

export async function POST(req: NextRequest) {
  const auth = ensureAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const roundId = String(body.roundId || '').trim();
    if (!roundId) throw new Error('Umfrage-ID fehlt.');

    const sb = getSupabaseAdminClient();
    if (!sb) throw new Error('Supabase ist nicht konfiguriert.');

    const parsed = parseSongList(String(body.songsText || ''));
    if (!parsed.length) throw new Error('Keine Songs zum Hinzufügen gefunden.');

    const newSongsAsRows = parsed.map((song, index) => ({
      id: `new-${index}`,
      round_id: roundId,
      title: song.title,
      artist: song.artist,
      sort_order: index,
    })) as Song[];

    const internalDuplicateGroups = findSongDuplicateGroups(newSongsAsRows).filter((group) => group.kind === 'exact');
    if (internalDuplicateGroups.length) {
      throw new Error(formatDuplicateSongMessage(internalDuplicateGroups));
    }

    const { data: existingSongsData, error: existingSongsError } = await sb
      .from('release_voting_songs')
      .select('*')
      .eq('round_id', roundId)
      .order('sort_order');

    if (existingSongsError) throw existingSongsError;

    const existingSongs = (existingSongsData || []) as Song[];
    const existingByKey = new Map(existingSongs.map((song) => [normalizedSongKey(song), song]));
    const duplicateAgainstExisting = newSongsAsRows
      .map((song) => ({ newSong: song, existingSong: existingByKey.get(normalizedSongKey(song)) }))
      .filter((entry): entry is { newSong: Song; existingSong: Song } => Boolean(entry.existingSong));

    if (duplicateAgainstExisting.length) {
      const lines = duplicateAgainstExisting.slice(0, 8).map((entry) => `- ${combineSongLine(entry.newSong)} ist bereits vorhanden als ${combineSongLine(entry.existingSong)}`);
      throw new Error([
        'Diese Songs sind bereits in der Umfrage enthalten:',
        ...lines,
        duplicateAgainstExisting.length > 8 ? `- plus ${duplicateAgainstExisting.length - 8} weitere Doppler` : '',
      ].filter(Boolean).join('\n'));
    }

    const maxSortOrder = existingSongs.reduce((max, song) => Math.max(max, Number(song.sort_order || 0)), -1);
    const rows = parsed.map((song, index) => ({
      round_id: roundId,
      title: song.title,
      artist: song.artist,
      sort_order: maxSortOrder + 1 + index,
    }));

    const { error } = await sb.from('release_voting_songs').insert(rows);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbMessage(error) }, { status: 500 });
  }
}
