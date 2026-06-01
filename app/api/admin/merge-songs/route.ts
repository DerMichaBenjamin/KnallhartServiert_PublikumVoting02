import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { Song, Vote } from '@/lib/releaseVotingShared';

type VoteItemRow = {
  id: string;
  vote_id: string;
  song_id: string;
  points: number;
};

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
    const targetSongId = String(body.targetSongId || '').trim();
    const sourceSongId = String(body.sourceSongId || '').trim();

    if (!roundId) throw new Error('Umfrage-ID fehlt.');
    if (!targetSongId) throw new Error('Ziel-Song fehlt.');
    if (!sourceSongId) throw new Error('Doppelter Song fehlt.');
    if (targetSongId === sourceSongId) throw new Error('Ziel-Song und Doppler dürfen nicht identisch sein.');

    const sb = getSupabaseAdminClient();
    if (!sb) throw new Error('Supabase ist nicht konfiguriert.');

    const { data: songsData, error: songsError } = await sb
      .from('release_voting_songs')
      .select('*')
      .eq('round_id', roundId)
      .in('id', [targetSongId, sourceSongId]);

    if (songsError) throw songsError;

    const songs = (songsData || []) as Song[];
    const targetSong = songs.find((song) => song.id === targetSongId);
    const sourceSong = songs.find((song) => song.id === sourceSongId);

    if (!targetSong || !sourceSong) {
      throw new Error('Einer der Songs wurde in dieser Umfrage nicht gefunden.');
    }

    const { data: votesData, error: votesError } = await sb
      .from('release_voting_votes')
      .select('id')
      .eq('round_id', roundId);

    if (votesError) throw votesError;

    const voteIds = ((votesData || []) as Pick<Vote, 'id'>[]).map((vote) => vote.id);

    let items: VoteItemRow[] = [];
    if (voteIds.length) {
      const { data: itemsData, error: itemsError } = await sb
        .from('release_voting_vote_items')
        .select('id, vote_id, song_id, points')
        .in('vote_id', voteIds)
        .in('song_id', [targetSongId, sourceSongId]);

      if (itemsError) throw itemsError;
      items = (itemsData || []) as VoteItemRow[];
    }

    const targetItemByVoteId = new Map(
      items.filter((item) => item.song_id === targetSongId).map((item) => [item.vote_id, item])
    );
    const sourceItems = items.filter((item) => item.song_id === sourceSongId);

    for (const sourceItem of sourceItems) {
      const targetItem = targetItemByVoteId.get(sourceItem.vote_id);

      if (!targetItem) {
        const { error } = await sb
          .from('release_voting_vote_items')
          .update({ song_id: targetSongId })
          .eq('id', sourceItem.id)
          .eq('vote_id', sourceItem.vote_id);

        if (error) throw error;
        continue;
      }

      const sourcePoints = Number(sourceItem.points || 0);
      const targetPoints = Number(targetItem.points || 0);

      const { error: deleteSourceItemError } = await sb
        .from('release_voting_vote_items')
        .delete()
        .eq('id', sourceItem.id)
        .eq('vote_id', sourceItem.vote_id);

      if (deleteSourceItemError) throw deleteSourceItemError;

      if (sourcePoints > targetPoints) {
        const { error: updateTargetPointsError } = await sb
          .from('release_voting_vote_items')
          .update({ points: sourcePoints })
          .eq('id', targetItem.id)
          .eq('vote_id', targetItem.vote_id);

        if (updateTargetPointsError) throw updateTargetPointsError;
      }
    }

    const { error: updateZonkError } = await sb
      .from('release_voting_votes')
      .update({ zonk_song_id: targetSongId })
      .eq('round_id', roundId)
      .eq('zonk_song_id', sourceSongId);

    if (updateZonkError) throw updateZonkError;

    const { error: deleteSongError } = await sb
      .from('release_voting_songs')
      .delete()
      .eq('id', sourceSongId)
      .eq('round_id', roundId);

    if (deleteSongError) throw deleteSongError;

    await sb
      .from('release_voting_rounds')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', roundId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbMessage(error) }, { status: 500 });
  }
}
