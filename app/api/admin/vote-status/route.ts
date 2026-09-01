import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';

function clean(value: unknown) {
  return String(value || '').trim();
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

export async function POST(req: NextRequest) {
  const auth = ensureAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const voteIds = Array.from(new Set([
      ...((Array.isArray(body.voteIds) ? body.voteIds : []).map(clean)),
      clean(body.voteId),
    ].filter(Boolean)));
    const action = clean(body.action);
    const sb = getSupabaseAdminClient();

    if (!sb) throw new Error('Supabase ist nicht konfiguriert.');
    if (!voteIds.length) throw new Error('Vote-ID fehlt.');

    const now = new Date().toISOString();

    if (action === 'count') {
      const { error } = await sb
        .from('release_voting_votes')
        .update({
          is_counted: true,
          integrity_status: 'approved',
          moderated_at: now,
          integrity_updated_at: now,
        })
        .in('id', voteIds)
        .eq('is_verified', true);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'exclude') {
      const { error } = await sb
        .from('release_voting_votes')
        .update({
          is_counted: false,
          integrity_status: 'excluded',
          moderated_at: now,
          integrity_updated_at: now,
        })
        .in('id', voteIds);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'review') {
      const { error } = await sb
        .from('release_voting_votes')
        .update({
          is_counted: false,
          integrity_status: 'review',
          moderated_at: now,
          integrity_updated_at: now,
        })
        .in('id', voteIds);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    throw new Error('Unbekannte Vote-Aktion.');
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbMessage(error) }, { status: 500 });
  }
}
