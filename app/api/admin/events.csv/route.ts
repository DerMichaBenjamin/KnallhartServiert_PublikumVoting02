import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sortEventsForShow } from '@/lib/config';

function csvEscape(value: unknown) {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Nicht angemeldet. Nur Admins können die CSV exportieren.' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || '';
  const location = searchParams.get('location') || '';
  const artist = searchParams.get('artist') || '';

  let q = supabaseAdmin().from('events').select('*').order('date', { ascending: false }).order('location').order('time');
  if (date) q = q.eq('date', date);
  if (location) q = q.eq('location', location);
  if (artist) q = q.ilike('title', `%${artist}%`);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: `CSV-Export fehlgeschlagen: ${error.message}` }, { status: 500 });

  const rows = sortEventsForShow(data || []).map((e: any) => [e.date, e.location, e.time, e.title, e.created_at, e.updated_at]);
  const header = ['Datum', 'Location', 'Uhrzeit', 'Artist', 'Erstellt am', 'Aktualisiert am'];
  const csv = '\ufeff' + [header, ...rows].map(row => row.map(csvEscape).join(';')).join('\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="knallhart_serviert_live_auftritte_export.csv"'
    }
  });
}
