import { NextRequest, NextResponse } from 'next/server';
import { ensureAdminRequest } from '@/lib/adminAuth';
import { getStatisticsWeeksBatch } from '@/lib/releaseStatistics';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = ensureAdminRequest(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });

  try {
    const offset = Number(request.nextUrl.searchParams.get('offset') || 0);
    const limit = Number(request.nextUrl.searchParams.get('limit') || 2);
    const batch = await getStatisticsWeeksBatch(offset, limit);
    return NextResponse.json({ ok: true, ...batch }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Historische Statistiken konnten nicht geladen werden.' }, { status: 500 });
  }
}
