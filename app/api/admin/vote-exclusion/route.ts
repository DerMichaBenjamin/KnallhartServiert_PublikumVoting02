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
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const voteId = clean(body.voteId);
    const excluded = Boolean(body.excluded);
    const reason = clean(body.reason);

    if (!voteId) throw new Error('Vote-ID fehlt.');

    const sb = getSupabaseAdminClient();
    if (!sb) throw new Error('Supabase ist nicht konfiguriert.');

    const patch = excluded
      ? {
          is_excluded: true,
          excluded_reason: reason || 'Manuell im Adminbereich ausgeschlossen',
          excluded_at: new Date().toISOString(),
        }
      : {
          is_excluded: false,
          excluded_reason: null,
          excluded_at: null,
        };

    const { data, error } = await sb
      .from('release_voting_votes')
      .update(patch)
      .eq('id', voteId)
      .select('id,is_verified,is_excluded,excluded_reason,excluded_at')
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) throw new Error('Stimme wurde nicht gefunden.');

    return NextResponse.json({ ok: true, vote: data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbMessage(error) }, { status: 500 });
  }
}
