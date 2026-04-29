import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getImpressum } from '@/lib/impressum';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const impressum = await getImpressum();
  return NextResponse.json({ impressum });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  const body = await req.json();
  const title = String(body.title || 'Impressum').trim().slice(0, 120);
  const content = String(body.content || '').trim();
  if (!content) return NextResponse.json({ error: 'Der Impressum-Text darf nicht leer sein.' }, { status: 400 });

  const { error } = await supabaseAdmin()
    .from('legal_pages')
    .upsert({ slug: 'impressum', title, content }, { onConflict: 'slug' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
