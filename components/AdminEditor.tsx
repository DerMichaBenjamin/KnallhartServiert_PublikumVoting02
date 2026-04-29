'use client';
import { useEffect, useMemo, useState } from 'react';
import StoryCanvas from './StoryCanvas';
import ExportButton from './ExportButton';
import { EventItem, LOCATIONS, LocationName, shiftDate, sortEventsForShow, dedupeEvents, timeOptions, todayISO } from '@/lib/config';

const times = timeOptions();
const emptyByLocation = (_date: string) => LOCATIONS.flatMap(_location => [] as EventItem[]);

type Notice = { type: 'ok' | 'error' | 'info'; text: string } | null;

async function readJsonSafely(res: Response) {
  try { return await res.json(); } catch { return { error: `Ungültige Server-Antwort (${res.status}).` }; }
}

export default function AdminEditor({ initialDate = todayISO() }: { initialDate?: string }) {
  const [date, setDate] = useState(initialDate);
  const [events, setEvents] = useState<EventItem[]>(emptyByLocation(initialDate));
  const [password, setPassword] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const sortedEvents = useMemo(() => sortEventsForShow(events), [events]);

  useEffect(() => { load(date); }, [date]);

  async function load(d: string) {
    try {
      setNotice({ type: 'info', text: 'Termine werden geladen …' });
      const res = await fetch(`/api/events?date=${d}`, { cache: 'no-store' });
      const json = await readJsonSafely(res);
      if (!res.ok) throw new Error(json.error || `Laden fehlgeschlagen (${res.status}).`);
      setEvents(dedupeEvents(json.events || []));
      setNotice(null);
    } catch (err) {
      setEvents([]);
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Termine konnten nicht geladen werden.' });
    }
  }

  async function login() {
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const json = await readJsonSafely(res);
      if (!res.ok) throw new Error(json.error || `Login fehlgeschlagen (${res.status}).`);
      setLoggedIn(true);
      setNotice({ type: 'ok', text: 'Angemeldet. Du kannst jetzt Termine speichern.' });
    } catch (err) {
      setLoggedIn(false);
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Login fehlgeschlagen.' });
    }
  }

  function requireLogin() {
    if (loggedIn) return true;
    setNotice({ type: 'error', text: 'Nur Admins können Termine hinzufügen, ändern oder speichern. Bitte zuerst einloggen.' });
    return false;
  }
  function add(location: LocationName) {
    if (!requireLogin()) return;
    setEvents(sortEventsForShow([...events, { date, location, time: '20:00', title: '' }]));
  }
  function update(i: number, patch: Partial<EventItem>) {
    if (!requireLogin()) return;
    setEvents(sortEventsForShow(events.map((e, idx) => idx === i ? { ...e, ...patch } : e)));
  }
  function remove(i: number) {
    if (!requireLogin()) return;
    setEvents(events.filter((_, idx) => idx !== i));
  }
  async function save() {
    if (!requireLogin()) return;
    try {
      const invalid = events.find(e => e.title.trim() && !e.time);
      if (invalid) throw new Error('Mindestens ein Termin hat keine Uhrzeit.');
      const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, events: sortedEvents }) });
      const json = await readJsonSafely(res);
      if (!res.ok) throw new Error(json.error || `Speichern fehlgeschlagen (${res.status}).`);
      setNotice({ type: 'ok', text: json.message || `Termine für ${date} gespeichert.` });
      await load(date);
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : 'Speichern fehlgeschlagen.' });
    }
  }
  const noticeClass = notice?.type === 'error' ? 'text-[#d61f43]' : notice?.type === 'ok' ? 'text-green-700' : 'text-[#06285f]';

  return <div className="min-h-screen p-4 md:p-8 grid lg:grid-cols-[minmax(520px,1fr)_420px] gap-6">
    <section className="space-y-5">
      <div className="admin-card p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <a className="btn btn-secondary" href="/">Öffentliche Seite</a><a className="btn btn-secondary" href="/admin/archiv">Archiv</a><a className="btn btn-secondary" href="/admin/tabelle">Tabelle</a><a className="btn btn-secondary" href="/admin/impressum">Impressum</a>
        </div>
        {!loggedIn && <div className="flex gap-3 flex-wrap"><input className="input max-w-xs" type="password" placeholder="Admin-Passwort" value={password} onChange={e=>setPassword(e.target.value)} /><button className="btn" onClick={login}>Einloggen</button></div>}
        <div className="grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
          <label className="font-bold">Datum<input className="input mt-1" type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
          <button className="btn btn-secondary" onClick={()=>setDate(todayISO())}>Heute</button>
          <button className="btn btn-secondary" onClick={()=>setDate(shiftDate(todayISO(),1))}>Morgen</button>
          <button className="btn btn-secondary" onClick={()=>setDate(shiftDate(date,-1))}>Vorheriger Tag</button>
          <button className="btn btn-secondary" onClick={()=>setDate(shiftDate(date,1))}>Nächster Tag</button>
        </div>
        <p className="text-sm font-bold opacity-80">Sortierung: Der Veranstaltungstag läuft von 08:00 Uhr bis 07:59 Uhr. Termine nach Mitternacht bleiben im selben Veranstaltungstag und werden hinten einsortiert.</p>
        {!loggedIn && <p className="font-bold text-[#d61f43]">Nur eingeloggte Admins können Termine hinzufügen oder speichern.</p>}
        {notice && <p className={`font-bold ${noticeClass}`}>{notice.text}</p>}
      </div>
      {LOCATIONS.map(location => {
        const indexed = sortedEvents.map((e, i) => ({ e, i })).filter(x => x.e.location === location);
        return <div key={location} className="admin-card p-5 space-y-3">
          <div className="flex justify-between items-center"><h2 className="text-xl font-black">{location}</h2><button className="btn btn-secondary" disabled={!loggedIn} onClick={()=>add(location)}>+ Termin hinzufügen</button></div>
          {indexed.length > 8 && <p className="font-bold text-[#d61f43]">Viele Termine – bitte Vorschau prüfen.</p>}
          {indexed.map(({ e, i }) => <div key={`${e.location}-${i}`} className="grid grid-cols-[120px_1fr_auto] gap-2">
            <select className="input" disabled={!loggedIn} value={e.time} onChange={ev=>update(i,{ time: ev.target.value })}>{times.map(t=><option key={t}>{t}</option>)}</select>
            <input className="input" disabled={!loggedIn} placeholder="Artist / Terminname" value={e.title} onChange={ev=>update(i,{ title: ev.target.value })} />
            <button className="btn btn-danger" disabled={!loggedIn} onClick={()=>remove(i)}>Löschen</button>
          </div>)}
        </div>;
      })}
      <div className="admin-card p-5 flex gap-3 flex-wrap"><button className="btn" disabled={!loggedIn} onClick={save}>Termine speichern</button><ExportButton date={date} targetId="admin-story-export" /></div>
    </section>
    <aside className="admin-card p-4 h-fit sticky top-4"><h2 className="text-xl font-black mb-3">Live-Vorschau</h2><StoryCanvas date={date} events={sortedEvents} scale={0.37} exportId="admin-story-preview" /></aside>
    <div aria-hidden="true" className="fixed left-[-99999px] top-0 w-[1080px] h-[1920px] overflow-hidden"><StoryCanvas date={date} events={sortedEvents} scale={1} exportId="admin-story-export" /></div>
  </div>;
}
