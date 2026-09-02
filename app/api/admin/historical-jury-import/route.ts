import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { buildHistoricalJuryImportPlan, importHistoricalJuryVotes } from '@/lib/historicalJuryImport';

function message(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error) {
    const details = error as Record<string, unknown>;
    return [details.message, details.details, details.hint, details.code].filter(Boolean).map(String).join(' | ');
  }
  return String(error || 'Unbekannter Importfehler.');
}

export async function POST(request: NextRequest) {
  const auth = ensureAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({})) as { action?: unknown };
    const action = String(body.action || 'dry-run');
    if (action === 'dry-run') {
      const { report } = await buildHistoricalJuryImportPlan();
      return NextResponse.json({ ok: true, report });
    }
    if (action === 'apply') {
      const result = await importHistoricalJuryVotes();
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ ok: false, error: 'Unbekannte Importaktion.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: message(error) }, { status: 500 });
  }
}
