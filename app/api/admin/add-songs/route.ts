import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { combineSongLine, normalizedSongKey, parseSongList, type Song } from '@/lib/releaseVotingShared';

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

    const parsedRows = parsed.map((song, index) => ({
      id: `new-${index}`,
      round_id: roundId,
      title: song.title,
      artist: song.artist,
      sort_order: index,
    })) as Song[];

    // Eine gemischte Eingabe darf nicht komplett scheitern, nur weil einzelne
    // Zeilen bereits vorhanden sind. Pro exaktem normalisiertem Song bleibt die
    // erste Eingabe erhalten; weitere identische Zeilen werden protokolliert.
    const inputByKey = new Map<string, Song>();
    const duplicateInputRows: Song[] = [];
    for (const song of parsedRows) {
      const key = normalizedSongKey(song);
      if (inputByKey.has(key)) duplicateInputRows.push(song);
      else inputByKey.set(key, song);
    }
    const uniqueInputRows = [...inputByKey.values()];

    const { data: existingSongsData, error: existingSongsError } = await sb
      .from('release_voting_songs')
      .select('*')
      .eq('round_id', roundId)
      .order('sort_order');

    if (existingSongsError) throw existingSongsError;

    const existingSongs = (existingSongsData || []) as Song[];
    const existingByKey = new Map(existingSongs.map((song) => [normalizedSongKey(song), song]));
    const duplicateAgainstExisting = uniqueInputRows
      .map((song) => ({ newSong: song, existingSong: existingByKey.get(normalizedSongKey(song)) }))
      .filter((entry): entry is { newSong: Song; existingSong: Song } => Boolean(entry.existingSong));

    const existingKeys = new Set(existingByKey.keys());
    const songsToInsert = uniqueInputRows.filter((song) => !existingKeys.has(normalizedSongKey(song)));

    const maxSortOrder = existingSongs.reduce((max, song) => Math.max(max, Number(song.sort_order || 0)), -1);
    const rows = songsToInsert.map((song, index) => ({
      round_id: roundId,
      title: song.title,
      artist: song.artist,
      sort_order: maxSortOrder + 1 + index,
    }));

    if (rows.length) {
      const { error } = await sb.from('release_voting_songs').insert(rows);
      if (error) throw error;
    }

    const skippedExisting = duplicateAgainstExisting.map((entry) => ({
      submitted: combineSongLine(entry.newSong),
      existing: combineSongLine(entry.existingSong),
    }));
    const skippedInput = duplicateInputRows.map(combineSongLine);
    const notices = [
      rows.length ? `${rows.length} ${rows.length === 1 ? 'neuer Song wurde' : 'neue Songs wurden'} hinzugefügt.` : 'Es wurde kein neuer Song hinzugefügt.',
      skippedExisting.length ? `${skippedExisting.length} bereits ${skippedExisting.length === 1 ? 'vorhandener Song wurde' : 'vorhandene Songs wurden'} übersprungen.` : '',
      skippedInput.length ? `${skippedInput.length} doppelte ${skippedInput.length === 1 ? 'Zeile innerhalb der Eingabe wurde' : 'Zeilen innerhalb der Eingabe wurden'} übersprungen.` : '',
    ].filter(Boolean);

    return NextResponse.json({
      ok: true,
      message: notices.join(' '),
      addedCount: rows.length,
      skippedExistingCount: skippedExisting.length,
      skippedInputCount: skippedInput.length,
      addedSongs: rows.map(combineSongLine),
      skippedExisting,
      skippedInput,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbMessage(error) }, { status: 500 });
  }
}
