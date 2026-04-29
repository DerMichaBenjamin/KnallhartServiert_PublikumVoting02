import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { normalizeSlug, parseSongList, spotifyIdFromInput } from '@/lib/releaseVoting';

function iso(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function slugWithDate(title: string, startsAt: unknown) {
  const base = normalizeSlug(title || 'neue-songs-der-woche') || 'voting';
  const rawDate = String(startsAt || '').slice(0, 10);
  const datePart = rawDate ? rawDate.replaceAll('-', '-') : new Date().toISOString().slice(0, 10);
  const timePart = new Date().toISOString().slice(11, 19).replaceAll(':', '');
  return normalizeSlug(`${base}-${datePart}-${timePart}`);
}

function dbMessage(error: unknown) {
  if (!error) return 'Unbekannter Fehler.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) return String((error as any).message);
  return String(error);
}

export async function POST(req: NextRequest) {
  const auth = ensureAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const sb = getSupabaseAdminClient();
    if (!sb) throw new Error('Supabase ist nicht konfiguriert. Prüfe NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in Vercel.');

    if (body.setCurrent) {
      if (!body.id) throw new Error('Umfrage-ID fehlt.');
      await sb.from('release_voting_rounds').update({ is_current: false }).neq('id', body.id);
      const { error } = await sb.from('release_voting_rounds').update({ is_current: true, status: 'live' }).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.onlyUpdate) {
      if (!body.id) throw new Error('Umfrage-ID fehlt.');
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if ('spotifyPlaylistId' in body) patch.spotify_playlist_id = spotifyIdFromInput(body.spotifyPlaylistId);
      if ('isPublicResults' in body) patch.is_public_results = Boolean(body.isPublicResults);
      if ('status' in body) patch.status = body.status;

      const { error } = await sb.from('release_voting_rounds').update(patch).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const title = String(body.title || '').trim() || 'Neue Songs der Woche';
    const requestedSlug = String(body.slug || '').trim();
    const slug = requestedSlug ? normalizeSlug(requestedSlug) : slugWithDate(title, body.startsAt);
    const status = String(body.status || 'draft');

    const { data: existing } = await sb.from('release_voting_rounds').select('id').eq('slug', slug).maybeSingle();
    const finalSlug = existing ? `${slug}-${Date.now().toString().slice(-5)}` : slug;

    const { data: round, error } = await sb
      .from('release_voting_rounds')
      .insert({
        title,
        slug: finalSlug,
        description: String(body.description || '').trim(),
        status,
        starts_at: iso(body.startsAt),
        ends_at: iso(body.endsAt),
        places_count: Number(body.placesCount || 12),
        is_current: false,
        is_public_results: Boolean(body.isPublicResults),
        spotify_playlist_id: spotifyIdFromInput(body.spotifyPlaylistId),
      })
      .select('*')
      .single();

    if (error) throw error;

    if (status === 'live') {
      await sb.from('release_voting_rounds').update({ is_current: false }).neq('id', round.id);
      const { error: currentError } = await sb.from('release_voting_rounds').update({ is_current: true }).eq('id', round.id);
      if (currentError) throw currentError;
    }

    const songs = parseSongList(String(body.songsText || ''));
    if (songs.length) {
      const { error: songError } = await sb.from('release_voting_songs').insert(
        songs.map((song, index) => ({
          round_id: round.id,
          title: song.title,
          artist: song.artist,
          sort_order: index,
        }))
      );
      if (songError) throw songError;
    }

    return NextResponse.json({ ok: true, slug: finalSlug });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbMessage(error) }, { status: 500 });
  }
}
