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

function plusDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function slugWithDate(title: string, startsAt: unknown) {
  const base = normalizeSlug(title || 'neue-songs-der-woche') || 'voting';
  const rawDate = String(startsAt || '').slice(0, 10);
  const datePart = rawDate || new Date().toISOString().slice(0, 10);
  const timePart = new Date().toISOString().slice(11, 19).replaceAll(':', '');
  return normalizeSlug(`${base}-${datePart}-${timePart}`);
}

function dbMessage(error: unknown) {
  if (!error) return 'Unbekannter Fehler.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error) {
    const e = error as Record<string, unknown>;
    return [e.message, e.details, e.hint, e.code].filter(Boolean).map(String).join(' | ');
  }
  return String(error);
}

async function clearCurrentRound(sb: NonNullable<ReturnType<typeof getSupabaseAdminClient>>) {
  const { error } = await sb
    .from('release_voting_rounds')
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) throw error;
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

      // Nur diese Umfrage als öffentliche Haupt-Abstimmung markieren.
      // Status/Zeitraum bleiben unverändert, damit parallele private/DJ-Abstimmungen
      // nicht versehentlich die öffentliche Hauptseite übernehmen.
      await clearCurrentRound(sb);

      const { error } = await sb
        .from('release_voting_rounds')
        .update({ is_current: true, updated_at: new Date().toISOString() })
        .eq('id', body.id);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (body.onlyUpdate) {
      if (!body.id) throw new Error('Umfrage-ID fehlt.');
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if ('spotifyPlaylistId' in body) patch.spotify_playlist_id = spotifyIdFromInput(body.spotifyPlaylistId);
      if ('isPublicResults' in body) patch.is_public_results = Boolean(body.isPublicResults);
      if ('status' in body) patch.status = String(body.status || 'draft');
      if ('startsAt' in body) patch.starts_at = iso(body.startsAt);
      if ('endsAt' in body) patch.ends_at = iso(body.endsAt);
      if ('placesCount' in body) patch.places_count = Number(body.placesCount || 12);
      if ('title' in body) patch.title = String(body.title || '').trim() || 'Neue Songs der Woche';
      if ('description' in body) patch.description = String(body.description || '').trim();

      const { error } = await sb.from('release_voting_rounds').update(patch).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const title = String(body.title || '').trim() || 'Neue Songs der Woche';
    const requestedSlug = String(body.slug || '').trim();
    const startsAt = iso(body.startsAt) || new Date().toISOString();
    const endsAt = iso(body.endsAt) || plusDays(7);
    const slug = requestedSlug ? normalizeSlug(requestedSlug) : slugWithDate(title, startsAt);
    const status = String(body.status || 'draft');
    const makeCurrent = Boolean(body.makeCurrent);

    const { data: existing } = await sb.from('release_voting_rounds').select('id').eq('slug', slug).maybeSingle();
    const finalSlug = existing ? `${slug}-${Date.now().toString().slice(-5)}` : slug;

    if (makeCurrent) {
      await clearCurrentRound(sb);
    }

    const { data: round, error } = await sb
      .from('release_voting_rounds')
      .insert({
        title,
        slug: finalSlug,
        description: String(body.description || '').trim(),
        status,
        starts_at: startsAt,
        ends_at: endsAt,
        places_count: Number(body.placesCount || 12),
        is_current: makeCurrent,
        is_public_results: Boolean(body.isPublicResults),
        spotify_playlist_id: spotifyIdFromInput(body.spotifyPlaylistId),
      })
      .select('*')
      .single();

    if (error) throw error;
    if (!round?.id) throw new Error('Umfrage wurde nicht korrekt angelegt. Keine Round-ID erhalten.');

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
