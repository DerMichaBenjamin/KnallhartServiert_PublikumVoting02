import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE_NAME = 'khs_admin_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

type AdminAuthResult =
  | { ok: true }
  | { ok: false; error: string };

function adminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || '';
}

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.VOTE_VERIFY_SECRET?.trim() || adminPassword();
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value: string) {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function safeEquals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function createSessionToken() {
  const payload = base64UrlEncode(JSON.stringify({ iat: Date.now(), exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 }));
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token?: string | null) {
  if (!adminPassword() || !sessionSecret() || !token) return false;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  if (!safeEquals(sign(payload), signature)) return false;

  try {
    const data = JSON.parse(base64UrlDecode(payload)) as { exp?: number };
    return Boolean(data.exp && Date.now() <= data.exp);
  } catch {
    return false;
  }
}

function normalizeOrigin(value: string) {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    return url.origin;
  } catch {
    return '';
  }
}

function requestOrigin(request: NextRequest) {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  return host ? normalizeOrigin(`${proto}://${host}`) : '';
}

function hasValidOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  const configuredOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL || '');
  const ownOrigin = requestOrigin(request);

  return Boolean(
    normalizedOrigin &&
    (normalizedOrigin === configuredOrigin || normalizedOrigin === ownOrigin)
  );
}

export function isValidAdminPassword(password: string) {
  return Boolean(adminPassword()) && password === adminPassword();
}

export async function isAdminLoggedIn() {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE_NAME)?.value);
}

export function ensureAdminRequest(request: NextRequest): AdminAuthResult {
  if (!hasValidOrigin(request)) {
    return { ok: false, error: 'Admin-Anfrage wegen ungültiger Herkunft blockiert.' };
  }

  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (verifySessionToken(cookie)) return { ok: true };

  return { ok: false, error: 'Nicht eingeloggt.' };
}

export function createAdminLoginResponse() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export function createAdminLogoutResponse() {
  const res = NextResponse.redirect(new URL('/admin/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  res.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    path: '/',
    maxAge: 0,
  });
  return res;
}
