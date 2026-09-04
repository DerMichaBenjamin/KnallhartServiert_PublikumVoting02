import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import { getJuryOpenState, JURY_PLACES_COUNT, type JuryRoundJuror } from '@/lib/juryVoting';
import type { Round } from '@/lib/releaseVotingShared';
import { checkRateLimit, clientIpFromRequest, minutesUntil } from '@/lib/rateLimit';

type RankingEntry = { songId?: unknown; points?: unknown };

function clean(value: unknown) {
  return String(value || '').trim();
}

function dbMessage(error: unknown) {
  if (!error) return 'Unbekannter Serverfehler.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error) {
    const e = error as Record<string, unknown>;
    return [e.message, e.details, e.hint, e.code].filter(Boolean).map(String).join(' | ');
  }
  return String(error);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const accessToken = clean(body.accessToken);
    const ranking: RankingEntry[] = Array.isArray(body.ranking) ? body.ranking : [];
    const sb = getSupabaseAdminClient();

    if (!sb) throw new Error('Supabase ist nicht konfiguriert.');
    if (!accessToken) throw new Error('Persönlicher Jury-Link ist ungültig.');

    const ipLimit = checkRateLimit(`jury-submit:ip:${clientIpFromRequest(req)}`, 30, 60 * 60 * 1000);
    if (!ipLimit.ok) throw new Error(`Zu viele Speicher-Versuche. Bitte in ca. ${minutesUntil(ipLimit.resetAt)} Minuten erneut probieren.`);

    const { data: jurorData, error: jurorError } = await sb
      .from('release_voting_round_jurors')
      .select('*')
      .eq('access_token', accessToken)
      .eq('voting_role', 'jury')
      .eq('is_active', true)
      .maybeSingle();
    if (jurorError) throw jurorError;
    if (!jurorData) throw new Error('Dieser Jury-Link ist nicht mehr gültig.');
    const juror = jurorData as JuryRoundJuror;

    const [{ data: roundData, error: roundError }, { data: songsData, error: songsError }] = await Promise.all([
      sb.from('release_voting_rounds').select('*').eq('id', juror.round_id).maybeSingle(),
      sb.from('release_voting_songs').select('id').eq('round_id', juror.round_id).eq('is_active', true),
    ]);
    if (roundError) throw roundError;
    if (songsError) throw songsError;
    if (!roundData) throw new Error('Die zugehörige Abstimmung wurde nicht gefunden.');

    const round = roundData as Round;
    const openState = getJuryOpenState(round);
    if (!openState.isOpen) throw new Error(openState.closeReason || 'Das Jury-Voting ist geschlossen.');

    if (ranking.length !== JURY_PLACES_COUNT) throw new Error(`Bitte belege genau ${JURY_PLACES_COUNT} Plätze.`);

    const normalized = ranking.map((entry) => ({
      songId: clean(entry.songId),
      points: Number(entry.points),
    }));
    if (normalized.some((entry) => !entry.songId || !Number.isFinite(entry.points))) {
      throw new Error('Die Rangliste ist unvollständig.');
    }

    const songIds = normalized.map((entry) => entry.songId);
    const pointValues = normalized.map((entry) => entry.points);
    const expectedPoints = new Set(Array.from({ length: JURY_PLACES_COUNT }, (_, index) => JURY_PLACES_COUNT - index));
    const validSongIds = new Set((songsData || []).map((song) => String(song.id)));

    if (validSongIds.size < JURY_PLACES_COUNT) throw new Error(`Diese Runde enthält weniger als ${JURY_PLACES_COUNT} Songs.`);
    if (new Set(songIds).size !== JURY_PLACES_COUNT) throw new Error('Ein Song wurde mehrfach ausgewählt.');
    if (new Set(pointValues).size !== JURY_PLACES_COUNT || pointValues.some((points) => !expectedPoints.has(points))) {
      throw new Error('Die Punkte müssen exakt einmal von 12 bis 1 vergeben werden.');
    }
    if (songIds.some((id) => !validSongIds.has(id))) throw new Error('Mindestens ein Song gehört nicht zu dieser Runde. Bitte Seite neu laden.');

    const now = new Date().toISOString();
    const { data: existingVote, error: existingVoteError } = await sb
      .from('release_voting_jury_votes')
      .select('id')
      .eq('round_juror_id', juror.id)
      .maybeSingle();
    if (existingVoteError) throw existingVoteError;

    let voteId = existingVote?.id as string | undefined;
    let createdNewVote = false;
    if (!voteId) {
      const { data: created, error } = await sb
        .from('release_voting_jury_votes')
        .insert({ round_id: juror.round_id, round_juror_id: juror.id, submitted_at: now, updated_at: now })
        .select('id')
        .single();
      if (error) throw error;
      voteId = created?.id;
      createdNewVote = true;
    }

    if (!voteId) throw new Error('Jury-Stimme konnte nicht gespeichert werden.');

    const { data: oldItems, error: oldItemsError } = await sb
      .from('release_voting_jury_vote_items')
      .select('song_id,points')
      .eq('vote_id', voteId);
    if (oldItemsError) throw oldItemsError;

    const { error: deleteError } = await sb.from('release_voting_jury_vote_items').delete().eq('vote_id', voteId);
    if (deleteError) throw deleteError;

    const { error: insertError } = await sb.from('release_voting_jury_vote_items').insert(
      normalized.map((entry) => ({ vote_id: voteId, song_id: entry.songId, points: entry.points }))
    );

    if (insertError) {
      if (createdNewVote) {
        await sb.from('release_voting_jury_votes').delete().eq('id', voteId);
      } else if ((oldItems || []).length) {
        await sb.from('release_voting_jury_vote_items').insert(
          (oldItems || []).map((entry) => ({ vote_id: voteId, song_id: entry.song_id, points: entry.points }))
        );
      }
      throw insertError;
    }

    const { error: voteTimestampError } = await sb
      .from('release_voting_jury_votes')
      .update({ submitted_at: now, updated_at: now })
      .eq('id', voteId);
    if (voteTimestampError) throw voteTimestampError;

    return NextResponse.json({ ok: true, updated: Boolean(existingVote?.id), savedAt: now });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbMessage(error) }, { status: 500 });
  }
}
