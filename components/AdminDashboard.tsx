'use client';

import { useMemo, useState } from 'react';
import type { Round, Song, Vote, VoteItem } from '@/lib/releaseVoting';
import { buildLeaderboard, buildZonk, combineSongLine } from '@/lib/releaseVoting';

type Props = {
  rounds: Round[];
  currentRound: Round | null;
  songs: Song[];
  votes: Vote[];
  items: VoteItem[];
  impressum: string;
};

function todayLocalDateTime(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function AdminDashboard({ rounds, currentRound, songs, votes, items, impressum }: Props) {
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const verifiedVotes = useMemo(() => votes.filter((vote) => vote.is_verified), [votes]);
  const leaderboard = currentRound ? buildLeaderboard(songs, verifiedVotes, items) : [];
  const zonk = currentRound ? buildZonk(songs, verifiedVotes) : [];

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
          <span>Umfragen anlegen, Playlist speichern, Songs ergänzen und Ergebnisse prüfen.</span>
        </div>
      </section>

      {message && <div className={`notice ${message.type === 'ok' ? 'success' : 'error'}`}>{message.text}</div>}
      {busy && <div className="notice">Speichert…</div>}

      <section className="admin-stats-grid">
        <div className="stat-card"><small>Aktive Umfrage</small><b>{currentRound?.title || 'Keine'}</b></div>
        <div className="stat-card"><small>Umfragen</small><b>{rounds.length}</b></div>
        <div className="stat-card"><small>Bestätigte Stimmen</small><b>{verifiedVotes.length}</b></div>
        <div className="stat-card"><small>Songs aktuell</small><b>{songs.length}</b></div>
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
              startsAt: form.get('startsAt'),
              endsAt: form.get('endsAt'),
              placesCount: Number(form.get('placesCount') || 12),
              songsText: form.get('songsText'),
              spotifyPlaylistId: form.get('spotifyPlaylistId'),
              isPublicResults: form.get('isPublicResults') === 'on',
            });
          }}
        >
          <h2>Neue Umfrage anlegen</h2>
          <label>Titel<input name="title" defaultValue="Neue Songs der Woche" /></label>
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
          <label className="check-row"><input type="checkbox" name="isPublicResults" /> Ergebnis öffentlich anzeigen</label>
          <label>Songliste<textarea name="songsText" placeholder="Songtitel - Interpret" rows={9} /></label>
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
        <div className="admin-table-wrap">
          <table>
            <thead><tr><th>Titel</th><th>Status</th><th>Playlist</th><th>Öffentlich</th><th>Aktionen</th></tr></thead>
            <tbody>
              {rounds.map((round) => (
                <tr key={round.id}>
                  <td><b>{round.title}</b><br /><small>{round.slug}</small></td>
                  <td><span className="status-badge">{round.status}{round.is_current ? ' · aktuell' : ''}</span></td>
                  <td><input defaultValue={round.spotify_playlist_id || ''} onBlur={(event) => post('/api/admin/round', { id: round.id, spotifyPlaylistId: event.target.value, onlyUpdate: true })} /></td>
                  <td><input type="checkbox" defaultChecked={round.is_public_results} onChange={(event) => post('/api/admin/round', { id: round.id, isPublicResults: event.target.checked, onlyUpdate: true })} /></td>
                  <td className="action-cell"><button type="button" onClick={() => post('/api/admin/round', { id: round.id, setCurrent: true })}>Aktuell setzen</button><a href={`/release-voting/${round.slug}`} target="_blank">Öffnen</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {currentRound && (
        <section className="admin-card admin-form">
          <h2>Songs zur aktuellen Umfrage ergänzen</h2>
          <p><b>{currentRound.title}</b></p>
          <textarea id="newSongs" rows={5} placeholder="Song - Interpret" />
          <button className="submit" type="button" onClick={() => post('/api/admin/add-songs', { roundId: currentRound.id, songsText: (document.getElementById('newSongs') as HTMLTextAreaElement).value })}>Songs hinzufügen</button>
        </section>
      )}

      <section className="admin-grid two bottom">
        <div className="admin-card">
          <h2>Ergebnisse der aktuellen Runde</h2>
          <div className="admin-table-wrap compact">
            <table>
              <thead><tr><th>#</th><th>Song</th><th>Gesamt</th><th>Ø</th><th>Gewählt</th></tr></thead>
              <tbody>{leaderboard.map((row, index) => <tr key={row.song.id}><td>{index + 1}</td><td>{combineSongLine(row.song)}</td><td>{row.total}</td><td>{row.avg.toFixed(2)}</td><td>{row.count}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="admin-card">
          <h2>Z-O-N-K-Auswertung</h2>
          <ol className="zonk-admin-list">{zonk.filter((entry) => entry.count > 0).map((entry) => <li key={entry.song.id}>{combineSongLine(entry.song)} <b>{entry.count}</b></li>)}</ol>
          {!zonk.some((entry) => entry.count > 0) && <p>Noch keine Z-O-N-K-Stimmen vorhanden.</p>}
        </div>
      </section>
    </main>
  );
}
