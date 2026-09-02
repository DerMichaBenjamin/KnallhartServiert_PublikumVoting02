import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getVotingSecurityReport } from '@/lib/votingSecurity';

export async function GET(req: NextRequest) {
  const auth = ensureAdminRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  const roundId = String(req.nextUrl.searchParams.get('roundId') || '').trim();
  if (!roundId) return NextResponse.json({ ok: false, error: 'Umfrage-ID fehlt.' }, { status: 400 });

  try {
    const report = await getVotingSecurityReport(roundId);
    return NextResponse.json({ ok: true, activeAlerts: report.activeAlerts.length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Security-Auswertung fehlgeschlagen.' }, { status: 500 });
  }
}
