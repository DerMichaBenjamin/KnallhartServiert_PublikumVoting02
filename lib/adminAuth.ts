import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';

export const ADMIN_COOKIE_NAME = 'khs_admin_session';

function secret() { return process.env.ADMIN_PASSWORD?.trim() || ''; }
function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function expectedCookie() { return secret() ? hash(`khs:${secret()}`) : ''; }

export function isValidAdminPassword(password: string) { return Boolean(secret()) && password === secret(); }
export async function isAdminLoggedIn() {
  const store = await cookies();
  return Boolean(expectedCookie()) && store.get(ADMIN_COOKIE_NAME)?.value === expectedCookie();
}
export function ensureAdminRequest(request: NextRequest) {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (expectedCookie() && cookie === expectedCookie()) return { ok: true as const };
  return { ok: false as const, error: 'Nicht eingeloggt.' };
}
export function createAdminLoginResponse() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, expectedCookie(), { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 60*60*24*14 });
  return res;
}
export function createAdminLogoutResponse() {
  const res = NextResponse.redirect(new URL('/admin/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  res.cookies.set(ADMIN_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  return res;
}
