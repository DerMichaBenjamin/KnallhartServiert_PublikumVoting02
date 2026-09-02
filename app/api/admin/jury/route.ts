import { randomBytes } from 'node:crypto';
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

function token() {
  return randomBytes(24).toString('base64url');
}

function iso(value: unknown) {
  const raw = clean(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error('Ungültige Jury-Deadline.');
  return date.toISOString();
}

export async function POST(req: NextRequest) {
  const auth = ensureAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  try {
    const body = await req.json();
    const action = clean(body.action);
    const roundId = clean(body.roundId);
    const sb = getSupabaseAdminClient();

    if (!sb) throw new Error('Supabase ist nicht konfiguriert.');
    if (!roundId) throw new Error('Umfrage-ID fehlt.');

    if (action === 'settings') {
      const { error } = await sb
        .from('release_voting_rounds')
        .update({
          jury_voting_closed: Boolean(body.closed),
          jury_voting_ends_at: iso(body.endsAt),
          updated_at: new Date().toISOString(),
        })
        .eq('id', roundId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'add-defaults') {
      const { data: profiles, error: profilesError } = await sb
        .from('release_voting_jury_profiles')
        .select('id,name')
        .eq('is_default', true)
        .order('name');
      if (profilesError) throw profilesError;

      const { data: existing, error: existingError } = await sb
        .from('release_voting_round_jurors')
        .select('display_name')
        .eq('round_id', roundId)
        .eq('voting_role', 'jury');
      if (existingError) throw existingError;

      const existingNames = new Set((existing || []).map((row) => String(row.display_name || '').trim().toLowerCase()));
      const rows = (profiles || [])
        .filter((profile) => !existingNames.has(String(profile.name || '').trim().toLowerCase()))
        .map((profile) => ({
          round_id: roundId,
          profile_id: profile.id,
          display_name: profile.name,
          access_token: token(),
          voting_role: 'jury',
        }));

      if (rows.length) {
        const { error } = await sb.from('release_voting_round_jurors').insert(rows);
        if (error) throw error;
      }

      return NextResponse.json({ ok: true, added: rows.length });
    }

    if (action === 'add-juror') {
      const name = clean(body.name);
      if (!name) throw new Error('Bitte einen Namen für den Juror eingeben.');

      const { error } = await sb.from('release_voting_round_jurors').insert({
        round_id: roundId,
        display_name: name,
        access_token: token(),
        voting_role: 'jury',
      });
      if (error) {
        if (String(error.code || '') === '23505') throw new Error('Dieser Juror ist für diese Runde bereits angelegt.');
        throw error;
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'remove-juror') {
      const jurorId = clean(body.jurorId);
      if (!jurorId) throw new Error('Juroren-ID fehlt.');
      const { error } = await sb
        .from('release_voting_round_jurors')
        .delete()
        .eq('id', jurorId)
        .eq('round_id', roundId)
        .eq('voting_role', 'jury');
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'new-link') {
      const jurorId = clean(body.jurorId);
      if (!jurorId) throw new Error('Juroren-ID fehlt.');
      const { error } = await sb
        .from('release_voting_round_jurors')
        .update({ access_token: token(), updated_at: new Date().toISOString() })
        .eq('id', jurorId)
        .eq('round_id', roundId)
        .eq('voting_role', 'jury');
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    throw new Error('Unbekannte Jury-Aktion.');
  } catch (error) {
    return NextResponse.json({ ok: false, error: dbMessage(error) }, { status: 500 });
  }
}
