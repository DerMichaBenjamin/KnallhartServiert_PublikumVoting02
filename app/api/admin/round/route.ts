import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { findSongDuplicateGroups, formatDuplicateSongMessage, normalizeSlug, parseSongList, spotifyIdFromInput, type Song } from '@/lib/releaseVotingShared';

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


function formatDateForTitle(value: string) {
  const date = new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' }).format(safeDate);
}

function titleAlreadyHasDate(value: string) {
  return /(\b\d{1,2}\.\d{1,2}\.(?:\d{2}|\d{4})\b)|(\b\d{4}-\d{2}-\d{2}\b)/.test(value);
}

function titleWithDate(value: string, startsAt: string) {
  const cleanTitle = String(value || '').trim() || 'Neue Songs der Woche';
  if (titleAlreadyHasDate(cleanTitle)) return cleanTitle;
  return `${cleanTitle} ${formatDateForTitle(startsAt)}`;
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

      if ('isCurrent' in body) {
        const nextIsCurrent = Boolean(body.isCurrent);
        if (nextIsCurrent) await clearCurrentRound(sb);
        patch.is_current = nextIsCurrent;
      }

      if ('spotifyPlaylistId' in body) patch.spotify_playlist_id = spotifyIdFromInput(body.spotifyPlaylistId);
      if ('isPublicResults' in body) patch.is_public_results = Boolean(body.isPublicResults);
      if ('status' in body) patch.status = String(body.status || 'draft');
      if ('startsAt' in body) {
        const nextStartsAt = iso(body.startsAt);
        if (nextStartsAt) patch.starts_at = nextStartsAt;
      }
      if ('endsAt' in body) {
        const nextEndsAt = iso(body.endsAt);
        if (nextEndsAt) patch.ends_at = nextEndsAt;
      }
      if ('placesCount' in body) patch.places_count = Number(body.placesCount || 12);
      if ('title' in body) patch.title = String(body.title || '').trim() || 'Neue Songs der Woche';
      if ('description' in body) patch.description = String(body.description || '').trim();

      if ('slug' in body) {
        const nextSlug = normalizeSlug(String(body.slug || ''));
        if (!nextSlug) throw new Error('Slug darf nicht leer sein.');

        const { data: slugConflict, error: slugConflictError } = await sb
          .from('release_voting_rounds')
          .select('id')
          .eq('slug', nextSlug)
          .neq('id', body.id)
          .maybeSingle();

        if (slugConflictError) throw slugConflictError;
        if (slugConflict?.id) throw new Error('Dieser Slug wird bereits von einer anderen Umfrage verwendet.');

        patch.slug = nextSlug;
      }

      const { error } = await sb.from('release_voting_rounds').update(patch).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    const rawTitle = String(body.title || '').trim() || 'Neue Songs der Woche';
    const requestedSlug = String(body.slug || '').trim();
    const startsAt = iso(body.startsAt) || new Date().toISOString();
    const endsAt = iso(body.endsAt) || plusDays(7);
    const title = titleWithDate(rawTitle, startsAt);
    const slug = requestedSlug ? normalizeSlug(requestedSlug) : slugWithDate(rawTitle, startsAt);
    const status = String(body.status || 'draft');
    const makeCurrent = Boolean(body.makeCurrent);

    const { data: existing } = await sb.from('release_voting_rounds').select('id').eq('slug', slug).maybeSingle();
    const finalSlug = existing ? `${slug}-${Date.now().toString().slice(-5)}` : slug;

    if (makeCurrent) {
      await clearCurrentRound(sb);
    }

    const songs = parseSongList(String(body.songsText || ''));
    const duplicateGroups = findSongDuplicateGroups(
      songs.map((song, index) => ({
        id: `new-${index}`,
        round_id: 'new-round',
        title: song.title,
        artist: song.artist,
        sort_order: index,
      })) as Song[]
    ).filter((group) => group.kind === 'exact');

    if (duplicateGroups.length) {
      throw new Error(formatDuplicateSongMessage(duplicateGroups));
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
