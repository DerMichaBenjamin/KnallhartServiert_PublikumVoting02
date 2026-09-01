'use client';

import { useMemo, useState } from 'react';
import type { AdminRoundSummary, Round } from '@/lib/releaseVotingShared';

type Props = {
  rounds: Round[];
  currentRound: Round | null;
  currentDjRound: Round | null;
  roundSummaries: AdminRoundSummary[];
  impressum: string;
};

function todayLocalDateTime(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function dateTimeLocalToIso(value: FormDataEntryValue | string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatAdminDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(date);
}

function formatTitleDate(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' }).format(new Date());
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' }).format(date);
}

function defaultRoundTitle() {
  return `Neue Songs der Woche ${formatTitleDate()}`;
}

function statusLabel(status: string) {
  if (status === 'live') return 'Live';
  if (status === 'ended') return 'Beendet';
  return 'Entwurf';
}

export default function AdminDashboard({ rounds, currentRound, currentDjRound, roundSummaries, impressum }: Props) {
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const summaryByRoundId = useMemo(
    () => new Map(roundSummaries.map((summary) => [summary.roundId, summary])),
    [roundSummaries]
  );

  const totalVerified = useMemo(
    () => roundSummaries.reduce((sum, summary) => sum + summary.verifiedVotes, 0),
    [roundSummaries]
  );

  const totalPending = useMemo(
    () => roundSummaries.reduce((sum, summary) => sum + summary.pendingVotes, 0),
    [roundSummaries]
  );

  function copyBackendUrl(roundId: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    void navigator.clipboard?.writeText(`${origin}/admin/release-voting/${roundId}`);
    setMessage({ type: 'ok', text: 'Backend-Direktlink kopiert.' });
  }

  async function post(url: string, body: unknown, reload = true) {
    setMessage(null);
    setBusy(true);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        setMessage({ type: 'error', text: data?.error || 'Ungültige Server-Antwort.' });
        return false;
      }

      setMessage({ type: 'ok', text: 'Gespeichert.' });
      if (reload) window.location.reload();
      return true;
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unbekannter Fehler.' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero-card">
        <img src="/khs-logo.png" alt="Knallhart serviert" />
        <div>
          <p>Interner Verwaltungsbereich</p>
          <h1>Release Voting verwalten</h1>
          <span>Startseite mit kompakter Umfragen-Übersicht. Details und Ergebnisse liegen jetzt auf eigenen Umfrage-Seiten.</span>
        </div>
      </section>

      {message && <div className={`notice ${message.type === 'ok' ? 'success' : 'error'}`}>{message.text}</div>}
      {busy && <div className="notice">Speichert…</div>}

      <section className="admin-stats-grid">
        <div className="stat-card"><small>Öffentliche Haupt-Umfrage</small><b>{currentRound?.title || 'Keine'}</b></div>
        <div className="stat-card"><small>Aktuelles DJ-Voting</small><b>{currentDjRound?.title || 'Keine'}</b></div>
        <div className="stat-card"><small>Gültige Stimmen gesamt</small><b>{totalVerified}</b></div>
        <div className="stat-card"><small>Offen / unbestätigt gesamt</small><b>{totalPending}</b></div>
      </section>

      <section className="admin-grid two">
        <form
          className="admin-card admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            post('/api/admin/round', {
              title: form.get('title'),
              slug: form.get('slug'),
              description: form.get('description'),
              status: form.get('status'),
              startsAt: dateTimeLocalToIso(form.get('startsAt')),
              endsAt: dateTimeLocalToIso(form.get('endsAt')),
              placesCount: Number(form.get('placesCount') || 12),
              songsText: form.get('songsText'),
              spotifyPlaylistId: form.get('spotifyPlaylistId'),
              isPublicResults: form.get('isPublicResults') === 'on',
              makeCurrent: form.get('makeCurrent') === 'on',
              makeCurrentDj: form.get('makeCurrentDj') === 'on',
            });
          }}
        >
          <h2>Neue Umfrage anlegen</h2>
          <label>Titel<input name="title" defaultValue={defaultRoundTitle()} /></label>
          <p className="admin-help-text">Der Titel sollte das Datum enthalten, z. B. „Neue Songs der Woche {formatTitleDate()}“. Falls du kein Datum einträgst, ergänzt die API beim Anlegen automatisch das Startdatum.</p>
          <label>Slug / URL-Kürzel <input name="slug" placeholder="leer lassen = automatisch mit Datum" /></label>
          <label>Beschreibung<textarea name="description" defaultValue="Bewerte die stärksten neuen Releases der Woche." /></label>
          <div className="admin-form-row">
            <label>Status<select name="status" defaultValue="live"><option value="draft">Entwurf</option><option value="live">Live</option><option value="ended">Beendet</option></select></label>
            <label>Plätze<input name="placesCount" type="number" min="1" max="50" defaultValue={12} /></label>
          </div>
          <div className="admin-form-row">
            <label>Start<input name="startsAt" type="datetime-local" defaultValue={todayLocalDateTime(0)} /></label>
            <label>Ende<input name="endsAt" type="datetime-local" defaultValue={todayLocalDateTime(7)} /></label>
          </div>
          <label>Spotify-Playlist-ID oder URL<input name="spotifyPlaylistId" defaultValue="5F2g4rTr0KpYgy9YGiE4aI" /></label>
          <label className="check-row"><input type="checkbox" name="makeCurrent" defaultChecked /> Als öffentliche Haupt-Abstimmung unter /release-voting anzeigen</label>
          <label className="check-row"><input type="checkbox" name="makeCurrentDj" /> Als aktuelles DJ-Voting unter /dj-voting anzeigen</label>
          <label className="check-row"><input type="checkbox" name="isPublicResults" /> Ergebnis öffentlich anzeigen</label>
          <p className="admin-help-text">Für eine DJ-Abstimmung: Status „Live“ lassen, „öffentliche Haupt-Abstimmung“ deaktivieren und „aktuelles DJ-Voting“ aktivieren. DJs können dann dauerhaft denselben Link /dj-voting verwenden.</p>
          <label>Songliste<textarea name="songsText" placeholder="Songtitel - Interpret" rows={8} /></label>
          <button className="submit" type="submit">Umfrage anlegen</button>
        </form>

        <form
          className="admin-card admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            post('/api/admin/settings', { impressum: String(form.get('impressum') || '') });
          }}
        >
          <h2>Impressum</h2>
          <textarea name="impressum" rows={18} defaultValue={impressum} />
          <button className="submit" type="submit">Impressum speichern</button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Alle Umfragen</h2>
        <p className="admin-help-text">Kompakte Übersicht. Einstellungen, Direktlinks, Songs, Doppler-Merge, Teilnehmer und Ergebnisse bearbeitest du über „Details öffnen“.</p>
        <div className="admin-table-wrap compact">
          <table>
            <thead>
              <tr>
                <th>Titel</th>
                <th>Status</th>
                <th>Erstellt</th>
                <th>Teilnehmer</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => {
                const summary = summaryByRoundId.get(round.id);

                return (
                  <tr key={round.id}>
                    <td>
                      <b>{round.title}</b><br />
                      <small>{round.slug}</small>
                    </td>
                    <td>
                      <b>{statusLabel(round.status)}</b><br />
                      <small>{round.is_current ? 'Hauptseite' : 'nicht Hauptseite'} · {currentDjRound?.id === round.id ? 'DJ-Voting' : 'nicht DJ'} · {round.is_public_results ? 'Ergebnis öffentlich' : 'Ergebnis intern'}</small>
                    </td>
                    <td>{formatAdminDateTime(round.created_at)}</td>
                    <td className="vote-count-cell">
                      <b>{summary?.verifiedVotes || 0}</b> gültig<br />
                      <small>{summary?.pendingVotes || 0} offen · {summary?.totalVotes || 0} gesamt</small>
                    </td>
                    <td className="action-cell">
                      <a href={`/admin/release-voting/${round.id}`}>Details öffnen</a>
                      <button type="button" onClick={() => copyBackendUrl(round.id)}>Backend-Link kopieren</button>
                    </td>
                  </tr>
                );
              })}
              {!rounds.length && <tr><td colSpan={5}>Noch keine Umfragen angelegt.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
