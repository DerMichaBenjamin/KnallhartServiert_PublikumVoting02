import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { buildHistoricalJuryImportPlan, importHistoricalJuryVotes, importSingleHistoricalJuryVote, saveHistoricalImportMapping } from '@/lib/historicalJuryImport';

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
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || 'dry-run');
    if (action === 'dry-run') {
      const { report } = await buildHistoricalJuryImportPlan();
      return NextResponse.json({ ok: true, report });
    }
    if (action === 'apply') {
      const result = await importHistoricalJuryVotes();
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === 'apply-one') {
      const result = await importSingleHistoricalJuryVote(String(body.sheet || ''), String(body.sourceName || ''));
      return NextResponse.json({ ok: true, ...result });
    }
    if (action === 'save-mapping') {
      const mappingType = String(body.mappingType || '');
      if (!['round', 'song', 'juror', 'ranking'].includes(mappingType)) {
        return NextResponse.json({ ok: false, error: 'Unbekannter Zuordnungstyp.' }, { status: 400 });
      }
      const { report } = await saveHistoricalImportMapping({
        type: mappingType as 'round' | 'song' | 'juror' | 'ranking',
        sheet: String(body.sheet || ''),
        sourceName: body.sourceName == null ? undefined : String(body.sourceName),
        sourceSong: body.sourceSong == null ? undefined : String(body.sourceSong),
        value: body.value == null ? undefined : String(body.value),
        reason: body.reason == null ? undefined : String(body.reason),
        ranking: Array.isArray(body.ranking)
          ? body.ranking.map((item) => {
            const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
            return { songLabel: String(row.songLabel || ''), points: Number(row.points) };
          })
          : undefined,
      });
      return NextResponse.json({ ok: true, report });
    }
    return NextResponse.json({ ok: false, error: 'Unbekannte Importaktion.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: message(error) }, { status: 500 });
  }
}
