'use client';

import { useState } from 'react';
import { dateTimeLocalToIso } from '@/lib/adminUi';

function localDateTime(offsetDays = 0) { const date = new Date(); date.setDate(date.getDate() + offsetDays); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); }
function defaultTitle() { return `Neue Songs der Woche ${new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' }).format(new Date())}`; }

export default function NewRoundForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  return (
    <form className="ks-card ks-form ks-large-form" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setMessage(null); const form = new FormData(event.currentTarget);
      try {
        const response = await fetch('/api/admin/round', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.get('title'), slug: form.get('slug'), description: form.get('description'), status: form.get('status'), startsAt: dateTimeLocalToIso(form.get('startsAt')), endsAt: dateTimeLocalToIso(form.get('endsAt')), placesCount: Number(form.get('placesCount') || 12), songsText: form.get('songsText'), spotifyPlaylistId: form.get('spotifyPlaylistId'), isPublicResults: form.get('isPublicResults') === 'on', makeCurrent: form.get('makeCurrent') === 'on', makeCurrentDj: form.get('makeCurrentDj') === 'on' }) });
        const data = await response.json().catch(() => null); if (!response.ok || !data?.ok) throw new Error(data?.error || 'Die Umfrage konnte nicht angelegt werden.');
        setMessage({ type: 'ok', text: 'Umfrage angelegt. Die Übersicht wird geöffnet…' }); window.location.href = '/admin/rounds';
      } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unbekannter Fehler.' }); } finally { setBusy(false); }
    }}>
      {message && <div className={`notice ${message.type === 'ok' ? 'success' : 'error'}`}>{message.text}</div>}
      <div className="ks-form-section"><h2>Grunddaten</h2><p>Titel, URL und Zeitraum der Umfrage.</p></div>
      <label>Titel<input name="title" defaultValue={defaultTitle()} required /></label>
      <label>Slug / URL-Kürzel<input name="slug" placeholder="Leer lassen = automatisch" /></label>
      <label>Beschreibung<textarea name="description" defaultValue="Bewerte die stärksten neuen Releases der Woche." rows={3} /></label>
      <div className="ks-form-row three"><label>Status<select name="status" defaultValue="live"><option value="draft">Geplant</option><option value="live">Aktiv</option><option value="ended">Abgeschlossen</option></select></label><label>Start<input name="startsAt" type="datetime-local" defaultValue={localDateTime(0)} /></label><label>Ende<input name="endsAt" type="datetime-local" defaultValue={localDateTime(7)} /></label></div>
      <div className="ks-form-section"><h2>Voting</h2><p>Vorhandene Felder und Einstellungen bleiben vollständig erhalten.</p></div>
      <div className="ks-form-row two"><label>Plätze<input name="placesCount" type="number" min="1" max="50" defaultValue={12} /></label><label>Spotify-Playlist-ID oder URL<input name="spotifyPlaylistId" defaultValue="5F2g4rTr0KpYgy9YGiE4aI" /></label></div>
      <label>Songliste<textarea name="songsText" placeholder="Songtitel - Interpret" rows={10} /></label>
      <div className="ks-check-stack"><label><input type="checkbox" name="makeCurrent" defaultChecked /> Als öffentliche Haupt-Abstimmung unter /release-voting anzeigen</label><label><input type="checkbox" name="makeCurrentDj" /> Als aktuelles DJ-Voting unter /dj-voting anzeigen</label><label><input type="checkbox" name="isPublicResults" /> Ergebnis öffentlich anzeigen</label></div>
      <div className="ks-form-actions"><a className="ks-button secondary" href="/admin/rounds">Abbrechen</a><button className="ks-button primary" type="submit" disabled={busy}>{busy ? 'Wird angelegt…' : 'Umfrage anlegen'}</button></div>
    </form>
  );
}
