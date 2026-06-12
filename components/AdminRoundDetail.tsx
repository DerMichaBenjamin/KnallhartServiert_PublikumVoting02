'use client';

import { useMemo, useState } from 'react';
import type { AdminRoundSummary, Round, Song } from '@/lib/releaseVotingShared';
import { combineSongLine, findSongDuplicateGroups } from '@/lib/releaseVotingShared';

type Props = {
  round: Round;
  songs: Song[];
  summary: AdminRoundSummary;
  isCurrentDj: boolean;
};

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
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

function buildEmailList(participants: AdminRoundSummary['participants'], verifiedOnly = false) {
  return participants
    .filter((participant) => !verifiedOnly || participant.isVerified)
    .map((participant) => participant.email.trim())
    .filter(Boolean)
    .filter((email, index, list) => list.indexOf(email) === index)
    .join('\n');
}

function statusLabel(status: string) {
  if (status === 'live') return 'Live';
  if (status === 'ended') return 'Beendet';
  return 'Entwurf';
}

export default function AdminRoundDetail({ round, songs, summary, isCurrentDj }: Props) {
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const duplicateGroups = useMemo(() => findSongDuplicateGroups(songs), [songs]);
  const zonkRows = summary.zonk.filter((entry) => entry.count > 0);

  function copyPublicUrl(path: string, text = 'Link kopiert.') {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    void navigator.clipboard?.writeText(`${origin}${path}`);
    setMessage({ type: 'ok', text });
  }

  function copyBackendUrl() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    void navigator.clipboard?.writeText(`${origin}/admin/release-voting/${round.id}`);
    setMessage({ type: 'ok', text: 'Backend-Direktlink kopiert.' });
  }

  function copyParticipantEmails(verifiedOnly = false) {
    const emails = buildEmailList(summary.participants, verifiedOnly);

    if (!emails) {
      setMessage({ type: 'error', text: 'Keine passenden E-Mail-Adressen gefunden.' });
      return;
    }

    void navigator.clipboard?.writeText(emails);
    setMessage({ type: 'ok', text: verifiedOnly ? 'Bestätigte E-Mail-Adressen kopiert.' : 'Alle E-Mail-Adressen kopiert.' });
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
          <p>Umfrage bearbeiten</p>
          <h1>{round.title}</h1>
          <span>{round.slug} · {statusLabel(round.status)} · angelegt am {formatAdminDateTime(round.created_at)}</span>
        </div>
      </section>

      {message && <div className={`notice ${message.type === 'ok' ? 'success' : 'error'}`}>{message.text}</div>}
      {busy && <div className="notice">Speichert…</div>}

      <section className="admin-stats-grid">
        <div className="stat-card"><small>Gültige Teilnehmer</small><b>{summary.verifiedVotes}</b></div>
        <div className="stat-card"><small>Offen / unbestätigt</small><b>{summary.pendingVotes}</b></div>
        <div className="stat-card"><small>Gesamt eingegangen</small><b>{summary.totalVotes}</b></div>
        <div className="stat-card"><small>Songs</small><b>{summary.songsCount}</b></div>
      </section>

      <section className="admin-card">
        <div className="action-cell">
          <a href="/admin/release-voting">← Zur Übersicht</a>
          <a href={`/release-voting/${round.slug}`} target="_blank" rel="noreferrer">Publikums-Link öffnen</a>
          <button type="button" onClick={() => copyPublicUrl(`/release-voting/${round.slug}`, 'Publikums-Link kopiert.')}>Publikums-Link kopieren</button>
          <a href={`/dj-voting/${round.slug}`} target="_blank" rel="noreferrer">DJ-Direktlink öffnen</a>
          <button type="button" onClick={() => copyPublicUrl(`/dj-voting/${round.slug}`, 'DJ-Direktlink kopiert.')}>DJ-Direktlink kopieren</button>
          {isCurrentDj && <a href="/dj-voting" target="_blank" rel="noreferrer">Aktuelles DJ-Voting öffnen</a>}
          {isCurrentDj && <button type="button" onClick={() => copyPublicUrl('/dj-voting', 'Aktueller DJ-Link kopiert.')}>Aktuellen DJ-Link kopieren</button>}
          {round.is_public_results && <a href={`/ergebnisse/${round.slug}`} target="_blank" rel="noreferrer">Ergebnis öffnen</a>}
          {round.is_public_results && <button type="button" onClick={() => copyPublicUrl(`/ergebnisse/${round.slug}`, 'Ergebnis-Link kopiert.')}>Ergebnis-Link kopieren</button>}
          <button type="button" onClick={copyBackendUrl}>Backend-Link kopieren</button>
        </div>
      </section>

      <section className="admin-grid two">
        <form
          className="admin-card admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            post('/api/admin/round', {
              id: round.id,
              onlyUpdate: true,
              title: form.get('title'),
              slug: form.get('slug'),
              description: form.get('description'),
              status: form.get('status'),
              startsAt: dateTimeLocalToIso(form.get('startsAt')),
              endsAt: dateTimeLocalToIso(form.get('endsAt')),
              placesCount: Number(form.get('placesCount') || 12),
              spotifyPlaylistId: form.get('spotifyPlaylistId'),
              isCurrent: form.get('isCurrent') === 'on',
              isCurrentDj: form.get('isCurrentDj') === 'on',
              isPublicResults: form.get('isPublicResults') === 'on',
            });
          }}
        >
          <h2>Einstellungen</h2>
          <label>Titel<input name="title" defaultValue={round.title} /></label>
          <p className="admin-help-text">Der Titel sollte das Datum enthalten, z. B. „Neue Songs der Woche 11.05.2026“.</p>
          <label>Slug / URL-Kürzel<input name="slug" defaultValue={round.slug} /></label>
          <label>Beschreibung<textarea name="description" defaultValue={round.description || ''} rows={4} /></label>
          <div className="admin-form-row">
            <label>Status<select name="status" defaultValue={round.status}><option value="draft">Entwurf</option><option value="live">Live</option><option value="ended">Beendet</option></select></label>
            <label>Plätze<input name="placesCount" type="number" min="1" max="50" defaultValue={round.places_count || 12} /></label>
          </div>
          <div className="admin-form-row">
            <label>Start<input name="startsAt" type="datetime-local" defaultValue={toDateTimeLocal(round.starts_at)} /></label>
            <label>Ende<input name="endsAt" type="datetime-local" defaultValue={toDateTimeLocal(round.ends_at)} /></label>
          </div>
          <label>Spotify-Playlist-ID oder URL<input name="spotifyPlaylistId" defaultValue={round.spotify_playlist_id || ''} /></label>
          <label className="check-row"><input type="checkbox" name="isCurrent" defaultChecked={round.is_current} /> Als öffentliche Haupt-Abstimmung unter /release-voting anzeigen</label>
          <label className="check-row"><input type="checkbox" name="isCurrentDj" defaultChecked={isCurrentDj} /> Als aktuelles DJ-Voting unter /dj-voting anzeigen</label>
          <label className="check-row"><input type="checkbox" name="isPublicResults" defaultChecked={round.is_public_results} /> Ergebnis öffentlich unter /ergebnisse anzeigen</label>
          <p className="admin-help-text">Wenn diese Umfrage als aktuelles DJ-Voting markiert ist, können DJs jede Woche denselben Link /dj-voting verwenden. Der normale Publikums-Link /release-voting bleibt davon getrennt.</p>
          <button className="submit" type="submit">Einstellungen speichern</button>
        </form>

        <form
          className="admin-card admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            post('/api/admin/add-songs', { roundId: round.id, songsText: form.get('songsText') });
          }}
        >
          <h2>Songs ergänzen</h2>
          <p className="admin-help-text">Doppelte Songs werden beim Hinzufügen blockiert. Bestehende Doppler kannst du unten zusammenführen.</p>
          <label>Neue Songs<textarea name="songsText" rows={9} placeholder="Songtitel - Interpret" /></label>
          <button className="submit" type="submit">Songs hinzufügen</button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Doppler prüfen & Songs zusammenführen</h2>
        <p className="admin-help-text">Kein automatisches Zusammenführen. Du entscheidest bewusst, welcher Song behalten wird. Stimmen und ZONK-Stimmen des Dopplers werden auf den Ziel-Song übertragen. Wenn ein Teilnehmer beide Varianten gewählt hat, bleibt nur die höhere Punktzahl erhalten.</p>

        {duplicateGroups.length ? (
          <div className="round-summary-list">
            {duplicateGroups.map((group) => {
              const defaultTarget = group.songs[0];
              const sourceCandidates = group.songs.slice(1);

              return (
                <div className="round-summary-card" key={group.key}>
                  <p><b>{group.kind === 'exact' ? 'Exakter Doppler' : 'Möglicher Doppler'}</b></p>
                  <ul>
                    {group.songs.map((song) => <li key={song.id}>{combineSongLine(song)}</li>)}
                  </ul>
                  {sourceCandidates.map((sourceSong) => (
                    <button
                      key={sourceSong.id}
                      type="button"
                      onClick={() => {
                        const ok = window.confirm(`"${combineSongLine(sourceSong)}" wirklich in "${combineSongLine(defaultTarget)}" zusammenführen?`);
                        if (!ok) return;
                        post('/api/admin/merge-songs', {
                          roundId: round.id,
                          targetSongId: defaultTarget.id,
                          sourceSongId: sourceSong.id,
                        });
                      }}
                    >
                      {combineSongLine(sourceSong)} → {combineSongLine(defaultTarget)} zusammenführen
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <p>Keine exakten oder möglichen Doppler erkannt.</p>
        )}

        {songs.length > 1 && (
          <form
            className="admin-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const targetSongId = String(form.get('targetSongId') || '');
              const sourceSongId = String(form.get('sourceSongId') || '');

              if (!targetSongId || !sourceSongId || targetSongId === sourceSongId) {
                setMessage({ type: 'error', text: 'Bitte zwei unterschiedliche Songs auswählen.' });
                return;
              }

              const targetSong = songs.find((song) => song.id === targetSongId);
              const sourceSong = songs.find((song) => song.id === sourceSongId);
              const ok = window.confirm(`"${sourceSong ? combineSongLine(sourceSong) : 'Doppler'}" wirklich in "${targetSong ? combineSongLine(targetSong) : 'Ziel-Song'}" zusammenführen?`);
              if (!ok) return;

              post('/api/admin/merge-songs', { roundId: round.id, targetSongId, sourceSongId });
            }}
          >
            <div className="admin-form-row">
              <label>
                Ziel behalten
                <select name="targetSongId" defaultValue={songs[0]?.id || ''}>
                  {songs.map((song) => <option key={song.id} value={song.id}>{combineSongLine(song)}</option>)}
                </select>
              </label>
              <label>
                Doppler zusammenführen/löschen
                <select name="sourceSongId" defaultValue={songs[1]?.id || ''}>
                  {songs.map((song) => <option key={song.id} value={song.id}>{combineSongLine(song)}</option>)}
                </select>
              </label>
            </div>
            <button type="submit">Ausgewählte Songs zusammenführen</button>
          </form>
        )}
      </section>

      <section className="admin-card">
        <h2>Auswertung</h2>
        <p className="admin-help-text">Gesamt = Summe der Punkte aus bestätigten Stimmen. Ø = Gesamtpunkte geteilt durch alle gültig bestätigten Stimmen dieser Umfrage. „Gewählt“ = wie oft der Song in bestätigten Top-Listen vorkommt.</p>
        <div className="admin-table-wrap compact">
          <table>
            <thead><tr><th>#</th><th>Song</th><th>Gesamt</th><th>Ø</th><th>Gewählt</th></tr></thead>
            <tbody>
              {summary.leaderboard.map((row, index) => (
                <tr key={row.song.id}>
                  <td>{index + 1}</td>
                  <td>{combineSongLine(row.song)}</td>
                  <td>{row.total}</td>
                  <td>{row.avg.toFixed(2)}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
              {!summary.leaderboard.length && <tr><td colSpan={5}>Keine Songs in dieser Umfrage vorhanden.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-grid two bottom">
        <div className="admin-card">
          <h2>ZONK-Auswertung</h2>
          {zonkRows.length ? <ol className="zonk-admin-list">{zonkRows.map((entry) => <li key={entry.song.id}>{combineSongLine(entry.song)} <b>{entry.count}</b></li>)}</ol> : <p>Noch keine bestätigten ZONK-Stimmen vorhanden.</p>}
        </div>

        <div className="admin-card">
          <h2>Teilnehmer dieser Abstimmung</h2>
          <p className="admin-help-text">Namen und E-Mail-Adressen bleiben nur im Backend sichtbar.</p>
          <div className="action-cell">
            <button type="button" disabled={!summary.participants.length} onClick={() => copyParticipantEmails(false)}>Alle E-Mails kopieren</button>
            <button type="button" disabled={!summary.participants.some((participant) => participant.isVerified)} onClick={() => copyParticipantEmails(true)}>Nur bestätigte E-Mails kopieren</button>
          </div>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-table-wrap compact" style={{ maxHeight: '520px', overflow: 'auto' }}>
          <table>
            <thead><tr><th>Status</th><th>Name</th><th>E-Mail</th><th>Instagram</th><th>Abgestimmt</th><th>Bestätigt</th><th>ZONK</th></tr></thead>
            <tbody>
              {summary.participants.map((participant) => (
                <tr key={participant.voteId}>
                  <td>{participant.isVerified ? 'Bestätigt' : 'Offen'}</td>
                  <td>{participant.name || '—'}</td>
                  <td>{participant.email ? <a href={`mailto:${participant.email}`}>{participant.email}</a> : '—'}</td>
                  <td>{participant.instagram || '—'}</td>
                  <td>{formatAdminDateTime(participant.votedAt)}</td>
                  <td>{formatAdminDateTime(participant.verifiedAt)}</td>
                  <td>{participant.zonkSong || '—'}</td>
                </tr>
              ))}
              {!summary.participants.length && <tr><td colSpan={7}>Noch keine Stimmen für diese Abstimmung vorhanden.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
