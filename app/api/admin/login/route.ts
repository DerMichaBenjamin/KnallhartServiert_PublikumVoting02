import { NextRequest, NextResponse } from 'next/server';
import { createAdminLoginResponse, isValidAdminPassword } from '@/lib/adminAuth';
import { checkRateLimit, clientIpFromRequest, minutesUntil } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  const limit = checkRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000);

  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: `Zu viele Login-Versuche. Bitte in ca. ${minutesUntil(limit.resetAt)} Minuten erneut probieren.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));

  if (!isValidAdminPassword(String(body.password || ''))) {
    return NextResponse.json({ ok: false, error: 'Falsches Passwort.' }, { status: 401 });
  }

  return createAdminLoginResponse();
}
