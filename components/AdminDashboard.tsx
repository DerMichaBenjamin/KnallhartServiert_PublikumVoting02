'use client';

import { useMemo, useState } from 'react';
import type { AdminRoundSummary, Round, Song, Vote, VoteItem } from '@/lib/releaseVoting';
import { buildLeaderboard, buildZonk, combineSongLine, findSongDuplicateGroups } from '@/lib/releaseVoting';

type Props = {
  rounds: Round[];
  currentRound: Round | null;
  songs: Song[];
  votes: Vote[];
  items: VoteItem[];
  roundSummaries: AdminRoundSummary[];
  impressum: string;
};

function todayLocalDateTime(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

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

function resultHelpText(summary?: AdminRoundSummary) {
  if (!summary) return 'Keine Auswertung vorhanden.';
  return `${summary.verifiedVotes} gültig bestätigte Stimmen · ${summary.pendingVotes} noch unbestätigt · ${summary.songsCount} Songs`;
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

export default function AdminDashboard({ rounds, currentRound, songs, votes, items, roundSummaries, impressum }: Props) {
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const verifiedVotes = useMemo(() => votes.filter((vote) => vote.is_verified), [votes]);
  const pendingVotes = votes.length - verifiedVotes.length;
  const leaderboard = currentRound ? buildLeaderboard(songs, verifiedVotes, items) : [];
  const zonk = currentRound ? buildZonk(songs, verifiedVotes) : [];
  const summaryByRoundId = useMemo(
    () => new Map(roundSummaries.map((summary) => [summary.roundId, summary])),
    [roundSummaries]
  );

  function copyPublicUrl(path: string, text = 'Link kopiert.') {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}${path}`;
    void navigator.clipboard?.writeText(url);
    setMessage({ type: 'ok', text });
  }

  function copyParticipantEmails(participants: AdminRoundSummary['participants'], verifiedOnly = false) {
    const emails = buildEmailList(participants, verifiedOnly);

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
          <p>Interner Verwaltungsbereich</p>
          <h1>Release Voting verwalten</h1>
          <span>Umfragen anlegen, Playlist speichern, Songs ergänzen und Ergebnisse prüfen.</span>
        </div>
      </section>

      {message && <div className={`notice ${message.type === 'ok' ? 'success' : 'error'}`}>{message.text}</div>}
      {busy && <div className="notice">Speichert…</div>}

      <section className="admin-stats-grid">
        <div className="stat-card"><small>Öffentliche Haupt-Umfrage</small><b>{currentRound?.title || 'Keine'}</b></div>
        <div className="stat-card"><small>Umfragen</small><b>{rounds.length}</b></div>
        <div className="stat-card"><small>Gültige Stimmen aktuell</small><b>{verifiedVotes.length}</b></div>
        <div className="stat-card"><small>Offen / unbestätigt aktuell</small><b>{pendingVotes}</b></div>
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
          <label className="check-row"><input type="checkbox" name="makeCurrent" defaultChecked /> Als öffentliche Haupt-Abstimmung unter /release-voting anzeigen</label>
          <label className="check-row"><input type="checkbox" name="isPublicResults" /> Ergebnis öffentlich anzeigen</label>
          <p className="admin-help-text">Für eine private DJ-Abstimmung: Status „Live“ lassen, aber „Als öffentliche Haupt-Abstimmung“ deaktivieren. Dann ist sie nur über den direkten Link in der Umfragen-Tabelle erreichbar.</p>
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
        <p className="admin-help-text">Start, Ende, Status, Playlist, Ergebnisfreigabe und Hauptseiten-Anzeige können nachträglich geändert werden. In der Spalte „Hauptseite“ bestimmst du, welche Umfrage unter /release-voting angezeigt wird. In der Spalte „Ergebnisse anzeigen“ bestimmst du, welche Abstimmungen auf /ergebnisse öffentlich erscheinen. Jede Umfrage hat außerdem eigene Direktlinks für Voting und Ergebnis.</p>
        <div className="admin-table-wrap">
          <table>
            <thead><tr><th>Titel</th><th>Status</th><th>Hauptseite</th><th>Zeitraum</th><th>Teilnehmer</th><th>Top Song</th><th>Playlist</th><th>Ergebnisse anzeigen</th><th>Direktlinks</th></tr></thead>
            <tbody>
              {rounds.map((round) => {
                const summary = summaryByRoundId.get(round.id);
                const topSong = summary?.leaderboard.find((row) => row.total > 0);

                return (
                  <tr key={round.id}>
                    <td><b>{round.title}</b><br /><small>{round.slug}</small></td>
                    <td>
                      <select
                        className="compact-select"
                        defaultValue={round.status}
                        onChange={(event) => post('/api/admin/round', { id: round.id, status: event.target.value, onlyUpdate: true })}
                      >
                        <option value="draft">Entwurf</option>
                        <option value="live">Live</option>
                        <option value="ended">Beendet</option>
                      </select>
                    </td>
                    <td>
                      <label className="check-row compact-check">
                        <input
                          type="checkbox"
                          checked={round.is_current}
                          onChange={(event) => post('/api/admin/round', { id: round.id, isCurrent: event.target.checked, onlyUpdate: true })}
                        />
                        {round.is_current ? 'Ja' : 'Nein'}
                      </label>
                    </td>
                    <td className="round-time-cell">
                      <label><small>Start</small><input type="datetime-local" defaultValue={toDateTimeLocal(round.starts_at)} onBlur={(event) => post('/api/admin/round', { id: round.id, startsAt: dateTimeLocalToIso(event.target.value), onlyUpdate: true })} /></label>
                      <label><small>Ende</small><input type="datetime-local" defaultValue={toDateTimeLocal(round.ends_at)} onBlur={(event) => post('/api/admin/round', { id: round.id, endsAt: dateTimeLocalToIso(event.target.value), onlyUpdate: true })} /></label>
                    </td>
                    <td className="vote-count-cell">
                      <b>{summary?.verifiedVotes || 0}</b> gültig<br />
                      <small>{summary?.pendingVotes || 0} offen · {summary?.totalVotes || 0} gesamt</small>
                    </td>
                    <td className="top-song-cell">
                      {topSong ? <><b>{combineSongLine(topSong.song)}</b><br /><small>{topSong.total} Punkte · {topSong.count}× gewählt</small></> : <small>Noch keine bestätigte Stimme</small>}
                    </td>
                    <td><input defaultValue={round.spotify_playlist_id || ''} onBlur={(event) => post('/api/admin/round', { id: round.id, spotifyPlaylistId: event.target.value, onlyUpdate: true })} /></td>
                    <td>
                      <label className="check-row compact-check">
                        <input
                          type="checkbox"
                          defaultChecked={round.is_public_results}
                          onChange={(event) => post('/api/admin/round', { id: round.id, isPublicResults: event.target.checked, onlyUpdate: true })}
                        />
                        {round.is_public_results ? 'Ja' : 'Nein'}
                      </label>
                    </td>
                    <td className="action-cell">
                      <a href={'/release-voting/' + round.slug} target="_blank" rel="noreferrer">Voting öffnen</a>
                      <button type="button" onClick={() => copyPublicUrl('/release-voting/' + round.slug, 'Voting-Link kopiert.')}>
                        Voting-Link kopieren
                      </button>

                      {round.is_public_results ? (
                        <>
                          <a href={'/ergebnisse#' + round.slug} target="_blank" rel="noreferrer">Ergebnis öffnen</a>
                          <button type="button" onClick={() => copyPublicUrl('/ergebnisse#' + round.slug, 'Ergebnis-Link kopiert.')}>
                            Ergebnis-Link kopieren
                          </button>
                        </>
                      ) : (
                        <small>Ergebnis nicht öffentlich</small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Auswertung je Umfrage</h2>
        <p className="admin-help-text"><b>Aktive Funktionen:</b> alle Songs, Teilnehmerliste, E-Mail-Kopieren, Doppler-Check und Song-Merge. Hier werden alle Songs und Teilnehmer der jeweiligen Umfrage angezeigt. Gesamt = Summe der Punkte aus bestätigten Stimmen. Ø = Gesamtpunkte geteilt durch alle gültig bestätigten Stimmen der Umfrage. „Gewählt“ = wie oft der Song in bestätigten Top-Listen vorkommt. Namen und E-Mail-Adressen bleiben nur im Backend sichtbar. Öffentlich sichtbar auf /ergebnisse sind nur Umfragen, bei denen oben „Ergebnisse anzeigen“ aktiviert ist.</p>
        <div className="round-summary-list">
          {rounds.map((round) => {
            const summary = summaryByRoundId.get(round.id);
            const resultRows = summary?.leaderboard || [];
            const roundSongs = resultRows.map((row) => row.song);
            const duplicateGroups = findSongDuplicateGroups(roundSongs);
            const zonkRows = (summary?.zonk || []).filter((entry) => entry.count > 0);
            const participants = summary?.participants || [];

            return (
              <details className="round-summary-card" key={round.id} open={round.is_current}>
                <summary>
                  <span><b>{round.title}</b><small>{round.slug}</small></span>
                  <em>{resultHelpText(summary)}</em>
                </summary>
                <div className="mini-stat-grid">
                  <div><small>Gültige Teilnehmer</small><b>{summary?.verifiedVotes || 0}</b></div>
                  <div><small>Unbestätigt</small><b>{summary?.pendingVotes || 0}</b></div>
                  <div><small>Gesamt eingegangen</small><b>{summary?.totalVotes || 0}</b></div>
                  <div><small>Songs</small><b>{summary?.songsCount || 0}</b></div>
                </div>

                <div className="zonk-summary">
                  <h3>Doppler prüfen & Songs zusammenführen</h3>
                  <p className="admin-help-text">Exakte Doppler werden beim neuen Speichern blockiert. Hier kannst du bestehende Doppler bewusst zusammenführen. Stimmen und ZONK-Stimmen des Dopplers werden auf den Ziel-Song übertragen. Wenn ein Teilnehmer beide Varianten gewählt hat, bleibt nur die höhere Punktzahl erhalten.</p>

                  {duplicateGroups.length ? (
                    <div className="round-summary-list">
                      {duplicateGroups.map((group) => {
                        const defaultTarget = group.songs[0];
                        const sourceCandidates = group.songs.slice(1);

                        return (
                          <div className="round-summary-card" key={group.key}>
                            <p><b>{group.kind === 'exact' ? 'Exakter Doppler' : 'Möglicher Doppler'}</b></p>
                            <ul>
                              {group.songs.map((song) => (
                                <li key={song.id}>{combineSongLine(song)}</li>
                              ))}
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

                  {roundSongs.length > 1 && (
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
                        const targetSong = roundSongs.find((song) => song.id === targetSongId);
                        const sourceSong = roundSongs.find((song) => song.id === sourceSongId);
                        const ok = window.confirm(`"${sourceSong ? combineSongLine(sourceSong) : 'Doppler'}" wirklich in "${targetSong ? combineSongLine(targetSong) : 'Ziel-Song'}" zusammenführen?`);
                        if (!ok) return;
                        post('/api/admin/merge-songs', { roundId: round.id, targetSongId, sourceSongId });
                      }}
                    >
                      <div className="admin-form-row">
                        <label>
                          Ziel behalten
                          <select name="targetSongId" defaultValue={roundSongs[0]?.id || ''}>
                            {roundSongs.map((song) => (
                              <option key={song.id} value={song.id}>{combineSongLine(song)}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Doppler zusammenführen/löschen
                          <select name="sourceSongId" defaultValue={roundSongs[1]?.id || ''}>
                            {roundSongs.map((song) => (
                              <option key={song.id} value={song.id}>{combineSongLine(song)}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <button type="submit">Ausgewählte Songs zusammenführen</button>
                    </form>
                  )}
                </div>

                <div className="admin-table-wrap compact">
                  <table>
                    <thead><tr><th>#</th><th>Song</th><th>Gesamt</th><th>Ø</th><th>Gewählt</th></tr></thead>
                    <tbody>
                      {resultRows.map((row, index) => (
                        <tr key={row.song.id}>
                          <td>{index + 1}</td>
                          <td>{combineSongLine(row.song)}</td>
                          <td>{row.total}</td>
                          <td>{row.avg.toFixed(2)}</td>
                          <td>{row.count}</td>
                        </tr>
                      ))}
                      {!resultRows.length && <tr><td colSpan={5}>Keine Songs in dieser Umfrage vorhanden.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="zonk-summary">
                  <h3>ZONK-Auswertung</h3>
                  {zonkRows.length ? <ol>{zonkRows.map((entry) => <li key={entry.song.id}>{combineSongLine(entry.song)} <b>{entry.count}</b></li>)}</ol> : <p>Noch keine bestätigten ZONK-Stimmen vorhanden.</p>}
                </div>

                <details className="zonk-summary">
                  <summary>
                    <span><b>Teilnehmer dieser Abstimmung</b><small>{participants.length} Einträge · nur im Backend sichtbar</small></span>
                    <em>aufklappen</em>
                  </summary>
                  <p className="admin-help-text">„Bestätigt“ zählt als gültige Stimme. „Offen“ wurde abgesendet, aber noch nicht per E-Mail bestätigt.</p>
                  <div className="action-cell">
                    <button type="button" disabled={!participants.length} onClick={() => copyParticipantEmails(participants)}>Alle E-Mails kopieren</button>
                    <button type="button" disabled={!participants.some((participant) => participant.isVerified)} onClick={() => copyParticipantEmails(participants, true)}>Nur bestätigte E-Mails kopieren</button>
                  </div>
                  <div className="admin-table-wrap compact" style={{ maxHeight: '420px', overflow: 'auto' }}>
                    <table>
                      <thead>
                        <tr><th>Status</th><th>Name</th><th>E-Mail</th><th>Instagram</th><th>Abgestimmt</th><th>Bestätigt</th><th>ZONK</th></tr>
                      </thead>
                      <tbody>
                        {participants.map((participant) => (
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
                        {!participants.length && <tr><td colSpan={7}>Noch keine Stimmen für diese Abstimmung vorhanden.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </details>
              </details>
            );
          })}
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
          <p className="admin-help-text">Aktuelle Runde: {verifiedVotes.length} gültige Stimmen, {pendingVotes} noch unbestätigt. Angezeigt werden alle Songs, auch mit 0 Punkten.</p>
          <div className="admin-table-wrap compact">
            <table>
              <thead><tr><th>#</th><th>Song</th><th>Gesamt</th><th>Ø</th><th>Gewählt</th></tr></thead>
              <tbody>{leaderboard.map((row, index) => <tr key={row.song.id}><td>{index + 1}</td><td>{combineSongLine(row.song)}</td><td>{row.total}</td><td>{row.avg.toFixed(2)}</td><td>{row.count}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="admin-card">
          <h2>ZONK-Auswertung</h2>
          <ol className="zonk-admin-list">{zonk.filter((entry) => entry.count > 0).map((entry) => <li key={entry.song.id}>{combineSongLine(entry.song)} <b>{entry.count}</b></li>)}</ol>
          {!zonk.some((entry) => entry.count > 0) && <p>Noch keine bestätigten ZONK-Stimmen vorhanden.</p>}
        </div>
      </section>
    </main>
  );
}
