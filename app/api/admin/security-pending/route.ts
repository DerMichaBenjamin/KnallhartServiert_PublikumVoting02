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
    return [e.message, e.details, e.hint, e.code]
      .filter(Boolean)
      .map(String)
      .join(' | ');
  }
  return String(error);
}

function isMissingIpHashColumn(error: unknown) {
  const message = dbMessage(error).toLowerCase();
  return message.includes('ip_hash') && (
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find')
  );
}

function emailDomain(email: string) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  return at >= 0 && at < normalized.length - 1
    ? normalized.slice(at + 1)
    : '';
}

export async function POST(req: NextRequest) {
  const auth = ensureAdminRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const roundId = clean(body.roundId);
    if (!roundId) throw new Error('Round-ID fehlt.');

    const sb = getSupabaseAdminClient();
    if (!sb) throw new Error('Supabase ist nicht konfiguriert.');

    let rows: Array<Record<string, any>> = [];

    const withIp = await sb
      .from('release_voting_votes')
      .select('id,juror_name,juror_email,created_at,verified_at,is_verified,is_excluded,ip_hash')
      .eq('round_id', roundId)
      .eq('voting_channel', 'audience')
      .eq('is_verified', false)
      .order('created_at', { ascending: true });

    if (withIp.error && isMissingIpHashColumn(withIp.error)) {
      const fallback = await sb
        .from('release_voting_votes')
        .select('id,juror_name,juror_email,created_at,verified_at,is_verified,is_excluded')
        .eq('round_id', roundId)
        .eq('voting_channel', 'audience')
        .eq('is_verified', false)
        .order('created_at', { ascending: true });

      if (fallback.error) throw fallback.error;
      rows = (fallback.data || []) as Array<Record<string, any>>;
    } else if (withIp.error) {
      throw withIp.error;
    } else {
      rows = (withIp.data || []) as Array<Record<string, any>>;
    }

    return NextResponse.json({
      ok: true,
      votes: rows.map((vote) => {
        const email = String(vote.juror_email || '');
        const ipHash = String(vote.ip_hash || '');
        return {
          voteId: String(vote.id),
          name: String(vote.juror_name || ''),
          email,
          createdAt: String(vote.created_at || ''),
          verifiedAt: vote.verified_at ? String(vote.verified_at) : null,
          isExcluded: Boolean(vote.is_excluded),
          domain: emailDomain(email),
          ipGroup: ipHash ? ipHash.slice(0, 8) : null,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: dbMessage(error) },
      { status: 500 }
    );
  }
}
