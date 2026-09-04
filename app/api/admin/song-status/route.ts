import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { areSongsDefiniteDuplicates, combineSongLine, type Song } from '@/lib/releaseVotingShared';

function dbMessage(error: unknown) {
  if (!error) return 'Unbekannter Fehler.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error) {
    const entry = error as Record<string, unknown>;
    return [entry.message, entry.details, entry.hint, entry.code].filter(Boolean).map(String).join(' | ');
  }
  return String(error);
}

export async function POST(req: NextRequest) {
  const auth = ensureAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const roundId = String(body.roundId || '').trim();
    const songId = String(body.songId || '').trim();
    if (!roundId) throw new Error('Umfrage-ID fehlt.');
    if (!songId) throw new Error('Song-ID fehlt.');
    if (typeof body.isActive !== 'boolean') throw new Error('Der gewünschte Songstatus fehlt.');
    const isActive = body.isActive;

    const sb = getSupabaseAdminClient();
    if (!sb) throw new Error('Supabase ist nicht konfiguriert.');

    const [{ data: songData, error: songError }, { data: roundData, error: roundError }] = await Promise.all([
      sb.from('release_voting_songs').select('*').eq('id', songId).eq('round_id', roundId).maybeSingle(),
      sb.from('release_voting_rounds').select('id,status,places_count').eq('id', roundId).maybeSingle(),
    ]);
    if (songError) throw songError;
    if (roundError) throw roundError;
    if (!songData) throw new Error('Der Song wurde in dieser Umfrage nicht gefunden.');
    if (!roundData) throw new Error('Die Umfrage wurde nicht gefunden.');

    const song = songData as Song;
    const currentlyActive = song.is_active !== false;
    if (currentlyActive === isActive) {
      return NextResponse.json({ ok: true, message: isActive ? 'Der Song ist bereits aktiv.' : 'Der Song ist bereits deaktiviert.' });
    }

    if (!isActive && roundData.status === 'live') {
      const { count, error } = await sb
        .from('release_voting_songs')
        .select('id', { count: 'exact', head: true })
        .eq('round_id', roundId)
        .eq('is_active', true);
      if (error) throw error;
      const remainingSongs = Math.max(0, (count || 0) - 1);
      const requiredSongs = Math.max(1, Number(roundData.places_count || 12));
      if (remainingSongs < requiredSongs) {
        throw new Error(`Der Song kann während einer laufenden Umfrage nicht deaktiviert werden: Danach wären nur ${remainingSongs} aktive Songs für ${requiredSongs} zu vergebende Plätze vorhanden.`);
      }
    }

    if (isActive) {
      const { data: activeSongsData, error } = await sb
        .from('release_voting_songs')
        .select('*')
        .eq('round_id', roundId)
        .eq('is_active', true)
        .neq('id', songId);
      if (error) throw error;
      const duplicate = ((activeSongsData || []) as Song[]).find((activeSong) => areSongsDefiniteDuplicates(activeSong, song));
      if (duplicate) {
        throw new Error(`Der Song kann nicht aktiviert werden, weil „${combineSongLine(duplicate)}“ bereits aktiv und als eindeutiger Doppler erkannt ist.`);
      }
    }

    const { error: updateError } = await sb
      .from('release_voting_songs')
      .update({ is_active: isActive })
      .eq('id', songId)
      .eq('round_id', roundId);
    if (updateError) throw updateError;

    await sb
      .from('release_voting_rounds')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', roundId);

    return NextResponse.json({
      ok: true,
      message: isActive
        ? `„${combineSongLine(song)}“ wurde wieder aktiviert.`
        : `„${combineSongLine(song)}“ wurde deaktiviert. Vorhandene Wertungen bleiben erhalten.`,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbMessage(error) }, { status: 500 });
  }
}
