import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { LOCATIONS, dedupeEvents, sortEventsForShow } from '@/lib/config';
import { supabaseAdmin } from '@/lib/supabase';

function errorResponse(message: string, status = 500, detail?: unknown) {
  console.error(message, detail || '');
  return NextResponse.json({ error: message, detail: detail instanceof Error ? detail.message : detail }, { status });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const admin = supabaseAdmin();
    let q = admin.from('events').select('*').order('date', { ascending: false }).order('location').order('time');
    if (date) q = q.eq('date', date);
    const { data, error } = await q;
    if (error) return errorResponse('Termine konnten nicht aus Supabase geladen werden. Prüfe SQL-Setup und ENV Variablen.', 500, error.message);
    return NextResponse.json({ events: sortEventsForShow(data || []) });
  } catch (err) {
    return errorResponse('Serverfehler beim Laden der Termine. Prüfe NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in Vercel.', 500, err);
  }
}

export async function POST(req: Request) {
  try {
    if (!(await isAdmin())) return errorResponse('Nicht angemeldet. Nur Admins können Auftritte hinzufügen oder ändern.', 401);
    const body = await req.json().catch(() => null);
    if (!body) return errorResponse('Ungültige Anfrage: Der Server konnte die gesendeten Daten nicht lesen.', 400);
    const date = String(body.date || '');
    const events = Array.isArray(body.events) ? body.events : [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errorResponse('Ungültiges Datum. Erwartetes Format: YYYY-MM-DD.', 400);

    const invalidLocation = events.find((e:any) => e.location && !LOCATIONS.includes(e.location));
    if (invalidLocation) return errorResponse(`Ungültige Location: ${invalidLocation.location}.`, 400);

    const cleaned = dedupeEvents(events
      .filter((e:any) => LOCATIONS.includes(e.location) && e.time && e.title?.trim())
      .map((e:any) => ({ date, location: e.location, time: e.time, title: String(e.title).trim() })));

    const admin = supabaseAdmin();

    // Wichtig: Speichern ersetzt immer den kompletten gewählten Tag. Dadurch werden alte Einträge nicht erneut angehängt.
    const del = await admin.from('events').delete().eq('date', date);
    if (del.error) return errorResponse('Speichern fehlgeschlagen: Alte Termine konnten nicht gelöscht werden. Prüfe Service-Role-Key und Tabelle events.', 500, del.error.message);

    if (cleaned.length) {
      const ins = await admin.from('events').upsert(cleaned, { onConflict: 'date,location,time,title', ignoreDuplicates: false });
      if (ins.error) return errorResponse('Speichern fehlgeschlagen: Neue Termine konnten nicht eingefügt werden. Prüfe SQL-Setup, eindeutigen Index, RLS und erlaubte Locations.', 500, ins.error.message);
    }
    return NextResponse.json({ ok: true, saved: cleaned.length, message: `${cleaned.length} Termin(e) gespeichert. Vorhandene Termine dieses Tages wurden ersetzt; doppelte identische Einträge wurden entfernt.` });
  } catch (err) {
    return errorResponse('Serverfehler beim Speichern. Prüfe Vercel ENV Variablen, Supabase SQL und Admin-Login.', 500, err);
  }
}
