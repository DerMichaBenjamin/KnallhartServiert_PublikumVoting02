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

type EmailFilter = 'all' | 'confirmed' | 'counted' | 'excluded';

function buildEmailList(participants: AdminRoundSummary['participants'], filter: EmailFilter) {
  return participants
    .filter((participant) => {
      if (filter === 'confirmed') return participant.isVerified;
      if (filter === 'counted') return participant.isVerified && !participant.isExcluded;
      if (filter === 'excluded') return participant.isExcluded;
      return true;
    })
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

function participantStatus(participant: AdminRoundSummary['participants'][number]) {
  if (!participant.isVerified && participant.isExcluded) return 'Unbestätigt · Ausgeschlossen';
  if (!participant.isVerified) return 'Unbestätigt';
  if (participant.isExcluded) return 'Bestätigt · Ausgeschlossen';
  return 'Bestätigt · Gewertet';
}

export default function AdminRoundDetail({ round, songs, summary, isCurrentDj }: Props) {
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedVoteIds, setSelectedVoteIds] = useState<string[]>([]);

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

  function copyParticipantEmails(filter: EmailFilter) {
    const emails = buildEmailList(summary.participants, filter);

    if (!emails) {
      setMessage({ type: 'error', text: 'Keine passenden E-Mail-Adressen gefunden.' });
      return;
    }

    void navigator.clipboard?.writeText(emails);

    const labels: Record<EmailFilter, string> = {
      all: 'Alle E-Mail-Adressen kopiert.',
      confirmed: 'Bestätigte E-Mail-Adressen kopiert.',
      counted: 'Gewertete E-Mail-Adressen kopiert.',
      excluded: 'Ausgeschlossene E-Mail-Adressen kopiert.',
    };
    setMessage({ type: 'ok', text: labels[filter] });
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

  const selectedParticipants = summary.participants.filter((participant) =>
    selectedVoteIds.includes(participant.voteId)
  );
  const selectedOpenParticipants = selectedParticipants.filter(
    (participant) => !participant.isExcluded
  );
  const selectedExcludedParticipants = selectedParticipants.filter(
    (participant) => participant.isExcluded
  );
  const selectedUnverifiedParticipants = selectedParticipants.filter(
    (participant) => !participant.isVerified
  );

  function isSelected(voteId: string) {
    return selectedVoteIds.includes(voteId);
  }

  function toggleSelected(voteId: string) {
    setSelectedVoteIds((current) =>
      current.includes(voteId)
        ? current.filter((id) => id !== voteId)
        : [...current, voteId]
    );
  }

  function addSelected(voteIds: string[]) {
    setSelectedVoteIds((current) => Array.from(new Set([...current, ...voteIds])));
  }

  function clearSelected() {
    setSelectedVoteIds([]);
  }

  async function setVoteExcluded(voteId: string, excluded: boolean, reason: string) {
    const response = await fetch('/api/admin/vote-exclusion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voteId, excluded, reason }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || 'Stimme konnte nicht geändert werden.');
    }
  }

  async function updateSelected(excluded: boolean) {
    const participants = excluded
      ? selectedOpenParticipants
      : selectedExcludedParticipants;

    if (!participants.length) {
      setMessage({
        type: 'error',
        text: excluded
          ? 'In deiner Auswahl ist keine noch nicht ausgeschlossene Stimme.'
          : 'In deiner Auswahl ist keine ausgeschlossene Stimme.',
      });
      return;
    }

    let reason = '';
    if (excluded) {
      reason = window.prompt(
        `Grund für den Ausschluss von ${participants.length} ausgewählten Stimmen:`,
        'Manuell im Adminbereich gesammelt ausgeschlossen'
      ) ?? '';
      if (!reason.trim()) return;
    }

    const ok = window.confirm(
      excluded
        ? `${participants.length} ausgewählte Stimmen ausschließen? Unbestätigte Stimmen bleiben auch ausgeschlossen, falls sie später per E-Mail bestätigt werden.`
        : `${participants.length} ausgewählte Stimmen wieder zulassen?`
    );
    if (!ok) return;

    setBusy(true);
    setMessage(null);
    try {
      const voteIds = participants.map((participant) => participant.voteId);
      for (let index = 0; index < voteIds.length; index += 4) {
        const chunk = voteIds.slice(index, index + 4);
        await Promise.all(
          chunk.map((voteId) => setVoteExcluded(voteId, excluded, reason))
        );
      }
      setMessage({ type: 'ok', text: `${voteIds.length} Stimmen wurden geändert.` });
      clearSelected();
      window.location.reload();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unbekannter Fehler.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleExcluded(participant: AdminRoundSummary['participants'][number]) {
    const nextExcluded = !participant.isExcluded;
    let reason = '';

    if (nextExcluded) {
      reason = window.prompt(
        `Grund für den Ausschluss von ${participant.email || participant.name || 'dieser Stimme'}:`,
        'Manuell im Adminbereich ausgeschlossen'
      ) ?? '';

      if (!reason.trim()) return;

      const ok = window.confirm(
        participant.isVerified
          ? 'Diese Stimme aus der offiziellen Wertung ausschließen? Sie bleibt vollständig gespeichert und kann später wieder zugelassen werden.'
          : 'Diese unbestätigte Stimme schon jetzt ausschließen? Falls sie später per E-Mail bestätigt wird, bleibt sie ausgeschlossen und wird nicht gewertet.'
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(
        'Diese Stimme wieder für die offizielle Wertung zulassen?'
      );
      if (!ok) return;
    }

    await post('/api/admin/vote-exclusion', {
      voteId: participant.voteId,
      excluded: nextExcluded,
      reason,
    });
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
        <div className="stat-card"><small>Bestätigt</small><b>{summary.confirmedVotes}</b></div>
        <div className="stat-card"><small>Gewertet</small><b>{summary.countedVotes}</b></div>
        <div className="stat-card"><small>Ausgeschlossen</small><b>{summary.excludedVotes}</b></div>
        <div className="stat-card"><small>Unbestätigt</small><b>{summary.unverifiedVotes}</b></div>
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
        <p className="admin-help-text">Gesamt = Summe der Punkte aus bestätigten und nicht ausgeschlossenen Stimmen. Ø = Gesamtpunkte geteilt durch alle gewerteten Stimmen dieser Umfrage. „Gewählt“ = wie oft der Song in gewerteten Top-Listen vorkommt.</p>
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
          {zonkRows.length ? <ol className="zonk-admin-list">{zonkRows.map((entry) => <li key={entry.song.id}>{combineSongLine(entry.song)} <b>{entry.count}</b></li>)}</ol> : <p>Noch keine gewerteten ZONK-Stimmen vorhanden.</p>}
        </div>

        <div className="admin-card">
          <h2>Teilnehmer dieser Abstimmung</h2>
          <p className="admin-help-text">Namen und E-Mail-Adressen bleiben nur im Backend sichtbar. Auch unbestätigte Stimmen können vorab ausgeschlossen werden. Falls sie später per Mail bestätigt werden, bleiben sie ausgeschlossen und werden nicht gewertet.</p>
          <div className="action-cell">
            <button type="button" disabled={!summary.participants.length} onClick={() => copyParticipantEmails('all')}>Alle E-Mails</button>
            <button type="button" disabled={!summary.participants.some((participant) => participant.isVerified)} onClick={() => copyParticipantEmails('confirmed')}>Bestätigte E-Mails</button>
            <button type="button" disabled={!summary.participants.some((participant) => participant.isVerified && !participant.isExcluded)} onClick={() => copyParticipantEmails('counted')}>Gewertete E-Mails</button>
            <button type="button" disabled={!summary.participants.some((participant) => participant.isExcluded)} onClick={() => copyParticipantEmails('excluded')}>Ausgeschlossene E-Mails</button>
          </div>

          <div className="action-cell" style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={busy || !summary.participants.some((participant) => participant.isVerified && !participant.isExcluded)}
              onClick={() => addSelected(summary.participants.filter((participant) => participant.isVerified && !participant.isExcluded).map((participant) => participant.voteId))}
            >
              Alle gewerteten markieren
            </button>
            <button
              type="button"
              disabled={busy || !summary.participants.some((participant) => !participant.isVerified && !participant.isExcluded)}
              onClick={() => addSelected(summary.participants.filter((participant) => !participant.isVerified && !participant.isExcluded).map((participant) => participant.voteId))}
            >
              Alle unbestätigten markieren
            </button>
            <button
              type="button"
              disabled={busy || !summary.participants.some((participant) => participant.isExcluded)}
              onClick={() => addSelected(summary.participants.filter((participant) => participant.isExcluded).map((participant) => participant.voteId))}
            >
              Alle ausgeschlossenen markieren
            </button>
            <button type="button" disabled={busy || !selectedVoteIds.length} onClick={clearSelected}>Auswahl aufheben</button>
          </div>

          {selectedVoteIds.length > 0 && (
            <div className="notice" style={{ marginBottom: 0 }}>
              <b>{selectedVoteIds.length} Stimmen ausgewählt.</b>{' '}
              {selectedOpenParticipants.length} noch nicht ausgeschlossen · {selectedExcludedParticipants.length} ausgeschlossen · {selectedUnverifiedParticipants.length} unbestätigt.
              <div className="action-cell" style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={busy || !selectedOpenParticipants.length}
                  onClick={() => updateSelected(true)}
                >
                  Ausgewählte ausschließen ({selectedOpenParticipants.length})
                </button>
                <button
                  type="button"
                  disabled={busy || !selectedExcludedParticipants.length}
                  onClick={() => updateSelected(false)}
                >
                  Ausgewählte wieder zulassen ({selectedExcludedParticipants.length})
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-table-wrap compact" style={{ maxHeight: '620px', overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Auswahl</th>
                <th>Status</th>
                <th>Name</th>
                <th>E-Mail</th>
                <th>Instagram</th>
                <th>Abgestimmt</th>
                <th>Bestätigt</th>
                <th>Ausschluss</th>
                <th>ZONK</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {summary.participants.map((participant) => (
                <tr key={participant.voteId}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isSelected(participant.voteId)}
                      onChange={() => toggleSelected(participant.voteId)}
                      aria-label={`Stimme von ${participant.email || participant.name || participant.voteId} auswählen`}
                    />
                  </td>
                  <td>{participantStatus(participant)}</td>
                  <td>{participant.name || '—'}</td>
                  <td>{participant.email ? <a href={`mailto:${participant.email}`}>{participant.email}</a> : '—'}</td>
                  <td>{participant.instagram || '—'}</td>
                  <td>{formatAdminDateTime(participant.votedAt)}</td>
                  <td>{formatAdminDateTime(participant.verifiedAt)}</td>
                  <td>
                    {participant.isExcluded ? (
                      <>
                        <b>Ausgeschlossen</b>
                        <br />
                        <small>{participant.excludedReason || '—'}</small>
                        <br />
                        <small>{formatAdminDateTime(participant.excludedAt)}</small>
                      </>
                    ) : '—'}
                  </td>
                  <td>{participant.zonkSong || '—'}</td>
                  <td>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleExcluded(participant)}
                    >
                      {participant.isExcluded
                        ? 'Wieder zulassen'
                        : participant.isVerified
                          ? 'Ausschließen'
                          : 'Vorab ausschließen'}
                    </button>
                  </td>
                </tr>
              ))}
              {!summary.participants.length && <tr><td colSpan={10}>Noch keine Stimmen für diese Abstimmung vorhanden.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
