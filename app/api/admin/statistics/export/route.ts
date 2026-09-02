import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getAdminRoundDetailData } from '@/lib/releaseVoting';
import { getAdminJuryRoundData } from '@/lib/juryVoting';
import { getReleaseStatisticsArchive } from '@/lib/releaseStatistics';
import { buildReleaseWeekStatistics } from '@/lib/releaseStatisticsCore';
import { buildArchiveExportSheets, buildWeekExportSheets, buildWeekResultRows } from '@/lib/releaseStatisticsExport';
import { createCsv, createXlsxWorkbook } from '@/lib/tabularExport';

export const dynamic = 'force-dynamic';

function safeFilename(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'release-check';
}

function download(body: BodyInit, filename: string, contentType: string) {
  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(request: NextRequest) {
  const auth = ensureAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  try {
    const format = request.nextUrl.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
    const scope = request.nextUrl.searchParams.get('scope') === 'all' ? 'all' : 'round';
    if (scope === 'all') {
      const archive = await getReleaseStatisticsArchive();
      const sheets = buildArchiveExportSheets(archive);
      if (format === 'xlsx') {
        const bytes = createXlsxWorkbook(sheets);
        return download(Buffer.from(bytes), 'release-check-gesamtauswertung.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }
      return download(createCsv(sheets[0].rows), 'release-check-gesamtauswertung.csv', 'text/csv; charset=utf-8');
    }

    const roundId = String(request.nextUrl.searchParams.get('roundId') || '').trim();
    if (!roundId) return NextResponse.json({ ok: false, error: 'Umfrage-ID fehlt.' }, { status: 400 });
    const [data, juryData] = await Promise.all([
      getAdminRoundDetailData(roundId),
      getAdminJuryRoundData(roundId),
    ]);
    if (!data) return NextResponse.json({ ok: false, error: 'Umfrage nicht gefunden.' }, { status: 404 });
    const week = buildReleaseWeekStatistics(data.round, data.songs, data.summary, juryData);
    const name = safeFilename(data.round.slug || data.round.title);
    if (format === 'xlsx') {
      const bytes = createXlsxWorkbook(buildWeekExportSheets(week));
      return download(Buffer.from(bytes), `${name}-auswertung.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
    return download(createCsv(buildWeekResultRows(week)), `${name}-auswertung.csv`, 'text/csv; charset=utf-8');
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Export fehlgeschlagen.' }, { status: 500 });
  }
}
