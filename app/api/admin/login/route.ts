import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminToken } from '@/lib/auth';

export async function POST(req: Request) {
  const { password } = await req.json();
  if (!process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'ADMIN_PASSWORD ist nicht gesetzt.' }, { status: 500 });
  if (password !== process.env.ADMIN_PASSWORD) return NextResponse.json({ error: 'Falsches Passwort.' }, { status: 401 });
  const store = await cookies();
  store.set('ks_admin', adminToken(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return NextResponse.json({ ok: true });
}
