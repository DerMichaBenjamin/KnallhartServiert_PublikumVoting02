'use client';

import { useMemo, useState } from 'react';
import type { Round } from '@/lib/releaseVotingShared';
import type { VotingSecurityAlert, VotingSecurityReport } from '@/lib/votingSecurityShared';

type Props = {
  round: Round;
  report: VotingSecurityReport;
};

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

function levelLabel(level: VotingSecurityAlert['level']) {
  if (level === 'high') return 'Hohe Auffälligkeit';
  if (level === 'warning') return 'Prüfen';
  return 'Hinweis';
}

function metric(value?: number | null, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value}${suffix}`;
}

export default function AdminVotingSecurity({ round, report }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [selectedVoteIds, setSelectedVoteIds] = useState<string[]>([]);

  const participantById = useMemo(() => {
    const map = new Map<
      string,
      VotingSecurityAlert['participants'][number]
    >();

    for (const alert of [...report.activeAlerts, ...report.resolvedAlerts]) {
      for (const participant of alert.participants) {
        map.set(participant.voteId, participant);
      }
    }

    return map;
  }, [report]);

  const selectedCount = selectedVoteIds.length;

  const selectedCountedIds = selectedVoteIds.filter(
    (voteId) => !participantById.get(voteId)?.isExcluded
  );

  const selectedExcludedIds = selectedVoteIds.filter(
    (voteId) => Boolean(participantById.get(voteId)?.isExcluded)
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
    setSelectedVoteIds((current) =>
      Array.from(new Set([...current, ...voteIds]))
    );
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

  async function changeMany(voteIds: string[], excluded: boolean, reason: string) {
    for (let index = 0; index < voteIds.length; index += 4) {
      const chunk = voteIds.slice(index, index + 4);
      await Promise.all(
        chunk.map((voteId) => setVoteExcluded(voteId, excluded, reason))
      );
    }
  }

  async function updateSelected(excluded: boolean) {
    const voteIds = excluded ? selectedCountedIds : selectedExcludedIds;

    if (!voteIds.length) {
      setMessage({
        type: 'error',
        text: excluded
          ? 'In deiner Auswahl ist keine derzeit gewertete Stimme.'
          : 'In deiner Auswahl ist keine ausgeschlossene Stimme.',
      });
      return;
    }

    let reason = '';

    if (excluded) {
      reason =
        window.prompt(
          `Grund für den Ausschluss von ${voteIds.length} ausgewählten Stimmen:`,
          'Sicherheitsprüfung: manuelle Sammelauswahl'
        ) ?? '';

      if (!reason.trim()) return;
    }

    const question = excluded
      ? `${voteIds.length} ausgewählte Stimmen aus der offiziellen Wertung ausschließen? Die Stimmen bleiben vollständig gespeichert.`
      : `${voteIds.length} ausgewählte Stimmen wieder für die offizielle Wertung zulassen?`;

    if (!window.confirm(question)) return;

    setBusy(true);
    setMessage(null);

    try {
      await changeMany(voteIds, excluded, reason);
      setMessage({
        type: 'ok',
        text: `${voteIds.length} Stimmen wurden geändert.`,
      });
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

  async function updateGroup(alert: VotingSecurityAlert, excluded: boolean) {
    const voteIds = excluded ? alert.countedVoteIds : alert.excludedVoteIds;
    if (!voteIds.length) return;

    let reason = '';

    if (excluded) {
      reason =
        window.prompt(
          'Grund für den Ausschluss dieser auffälligen Gruppe:',
          `Sicherheitsprüfung: ${alert.title}`
        ) ?? '';

      if (!reason.trim()) return;
    }

    const question = excluded
      ? `${voteIds.length} derzeit gewertete Stimmen dieser Gruppe ausschließen? Die Stimmen bleiben gespeichert.`
      : `${voteIds.length} ausgeschlossene Stimmen dieser Gruppe wieder zulassen?`;

    if (!window.confirm(question)) return;

    setBusy(true);
    setMessage(null);

    try {
      await changeMany(voteIds, excluded, reason);
      setMessage({ type: 'ok', text: 'Änderung gespeichert.' });
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

  async function updateSingle(voteId: string, excluded: boolean, alertTitle: string) {
    const question = excluded
      ? 'Diese Stimme aus der offiziellen Wertung ausschließen?'
      : 'Diese Stimme wieder für die offizielle Wertung zulassen?';

    if (!window.confirm(question)) return;

    const reason = excluded
      ? `Sicherheitsprüfung: ${alertTitle}`
      : '';

    setBusy(true);
    setMessage(null);

    try {
      await setVoteExcluded(voteId, excluded, reason);
      setMessage({ type: 'ok', text: 'Änderung gespeichert.' });
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

  function AlertCard({
    alert,
    resolved = false,
  }: {
    alert: VotingSecurityAlert;
    resolved?: boolean;
  }) {
    const countedParticipants = alert.participants.filter(
      (participant) => !participant.isExcluded
    );
    const excludedParticipants = alert.participants.filter(
      (participant) => participant.isExcluded
    );

    return (
      <section className="admin-card" key={alert.id}>
        <div className="action-cell" style={{ justifyContent: 'space-between' }}>
          <div>
            <small>{levelLabel(alert.level)}</small>
            <h2 style={{ marginTop: 4 }}>{alert.title}</h2>
          </div>
          <b>{alert.voteCount} Stimmen</b>
        </div>

        <p>{alert.description}</p>

        <div className="admin-stats-grid">
          <div className="stat-card">
            <small>Ziel-Song im Muster</small>
            <b>{alert.targetSong || '—'}</b>
          </div>
          <div className="stat-card">
            <small>Song gewählt</small>
            <b>{metric(alert.selectionPct, '%')}</b>
          </div>
          <div className="stat-card">
            <small>Ø Punkte Gruppe</small>
            <b>{metric(alert.averagePoints)}</b>
          </div>
          <div className="stat-card">
            <small>Ø übriges Publikum</small>
            <b>{metric(alert.baselineAveragePoints)}</b>
          </div>
          <div className="stat-card">
            <small>Punkte-Abweichung</small>
            <b>
              {alert.pointsLift == null
                ? '—'
                : `${alert.pointsLift >= 0 ? '+' : ''}${alert.pointsLift}`}
            </b>
          </div>
          <div className="stat-card">
            <small>Noch gewertet</small>
            <b>{alert.countedVoteIds.length}</b>
          </div>
        </div>

        <p className="admin-help-text">
          {alert.domain ? (
            <>
              Mail-Domain: <b>{alert.domain}</b> ·{' '}
            </>
          ) : null}
          {alert.ipGroup ? (
            <>
              anonymisierte Anschluss-Gruppe: <b>{alert.ipGroup}</b> ·{' '}
            </>
          ) : null}
          Zeitraum: {formatAdminDateTime(alert.windowStart)} bis{' '}
          {formatAdminDateTime(alert.windowEnd)}
        </p>

        <div className="action-cell">
          {!resolved && alert.countedVoteIds.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateGroup(alert, true)}
            >
              Noch gewertete Gruppe ausschließen
            </button>
          )}

          {resolved && alert.excludedVoteIds.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => updateGroup(alert, false)}
            >
              Gruppe wieder zulassen
            </button>
          )}
        </div>

        <details style={{ marginTop: 16 }}>
          <summary>Betroffene Stimmen ansehen</summary>

          <div
            className="admin-card"
            style={{
              marginTop: 12,
              padding: 14,
              boxShadow: 'none',
            }}
          >
            <div
              className="action-cell"
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {countedParticipants.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    addSelected(
                      countedParticipants.map(
                        (participant) => participant.voteId
                      )
                    )
                  }
                >
                  Alle gewerteten dieser Gruppe markieren
                </button>
              )}

              {excludedParticipants.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    addSelected(
                      excludedParticipants.map(
                        (participant) => participant.voteId
                      )
                    )
                  }
                >
                  Alle ausgeschlossenen dieser Gruppe markieren
                </button>
              )}

              <button
                type="button"
                disabled={busy || selectedCount === 0}
                onClick={clearSelected}
              >
                Auswahl aufheben
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <b>{selectedCount} Stimmen ausgewählt</b>
            </div>

            {selectedCount > 0 && (
              <div
                className="action-cell"
                style={{
                  marginTop: 10,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  disabled={busy || selectedCountedIds.length === 0}
                  onClick={() => updateSelected(true)}
                >
                  Ausgewählte gewertete ausschließen
                  {selectedCountedIds.length > 0
                    ? ` (${selectedCountedIds.length})`
                    : ''}
                </button>

                <button
                  type="button"
                  disabled={busy || selectedExcludedIds.length === 0}
                  onClick={() => updateSelected(false)}
                >
                  Ausgewählte ausgeschlossene wieder zulassen
                  {selectedExcludedIds.length > 0
                    ? ` (${selectedExcludedIds.length})`
                    : ''}
                </button>
              </div>
            )}
          </div>

          <div
            className="admin-table-wrap compact"
            style={{ marginTop: 12, maxHeight: 420, overflow: 'auto' }}
          >
            <table>
              <thead>
                <tr>
                  <th>Auswahl</th>
                  <th>Status</th>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Abgestimmt</th>
                  <th>Bestätigt</th>
                  <th>Aktion</th>
                </tr>
              </thead>

              <tbody>
                {alert.participants.map((participant) => (
                  <tr key={participant.voteId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected(participant.voteId)}
                        onChange={() => toggleSelected(participant.voteId)}
                        aria-label={`Stimme von ${
                          participant.email ||
                          participant.name ||
                          participant.voteId
                        } auswählen`}
                      />
                    </td>

                    <td>
                      {participant.isExcluded
                        ? 'Ausgeschlossen'
                        : 'Gewertet'}
                    </td>

                    <td>{participant.name || '—'}</td>
                    <td>{participant.email || '—'}</td>
                    <td>{formatAdminDateTime(participant.createdAt)}</td>
                    <td>{formatAdminDateTime(participant.verifiedAt)}</td>

                    <td>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          updateSingle(
                            participant.voteId,
                            !participant.isExcluded,
                            alert.title
                          )
                        }
                      >
                        {participant.isExcluded
                          ? 'Wieder zulassen'
                          : 'Ausschließen'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    );
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero-card">
        <img src="/khs-logo.png" alt="Knallhart serviert" />
        <div>
          <p>Sicherheitsprüfung</p>
          <h1>{round.title}</h1>
          <span>
            Passive Auffälligkeitserkennung. Es wird nichts automatisch
            ausgeschlossen.
          </span>
        </div>
      </section>

      <section className="admin-card">
        <div className="action-cell">
          <a href={`/admin/release-voting/${round.id}`}>
            ← Zurück zur Abstimmung
          </a>
        </div>
      </section>

      {message && (
        <div
          className={`notice ${
            message.type === 'ok' ? 'success' : 'error'
          }`}
        >
          {message.text}
        </div>
      )}

      {busy && <div className="notice">Speichert…</div>}

      {selectedCount > 0 && (
        <div className="notice">
          <b>{selectedCount} Stimmen ausgewählt.</b>{' '}
          {selectedCountedIds.length > 0 && (
            <>
              {selectedCountedIds.length} davon derzeit gewertet.{' '}
            </>
          )}
          {selectedExcludedIds.length > 0 && (
            <>
              {selectedExcludedIds.length} davon bereits ausgeschlossen.
            </>
          )}
        </div>
      )}

      <section className="admin-stats-grid">
        <div className="stat-card">
          <small>Bestätigte Stimmen geprüft</small>
          <b>{report.verifiedVotes}</b>
        </div>

        <div className="stat-card">
          <small>Aktiv gewertet</small>
          <b>{report.countedVotes}</b>
        </div>

        <div className="stat-card">
          <small>Aktive Auffälligkeiten</small>
          <b>{report.activeAlerts.length}</b>
        </div>

        <div className="stat-card">
          <small>Mit IP-Hash erfasst</small>
          <b>{report.trackedVerifiedVotes}</b>
        </div>
      </section>

      <section className="admin-card">
        <h2>IP-Tracking</h2>

        {report.trackingConfigured && report.ipColumnAvailable ? (
          <p>
            Aktiv. Gespeichert wird nur ein pro Abstimmungsrunde erzeugter
            Hash, keine Klartext-IP.
          </p>
        ) : (
          <p>
            Noch nicht vollständig aktiv.
            {!report.ipColumnAvailable
              ? ' Die Supabase-Spalte ip_hash fehlt.'
              : ''}
            {!report.trackingConfigured
              ? ' Die Vercel-Variable VOTING_IP_HASH_SECRET fehlt.'
              : ''}
          </p>
        )}
      </section>

      {report.errors.length > 0 && (
        <div className="notice error">
          Sicherheitsanalyse teilweise fehlgeschlagen:{' '}
          {report.errors.join(' · ')}
        </div>
      )}

      {report.activeAlerts.length === 0 ? (
        <div className="notice success">
          Aktuell keine noch gewerteten Stimmen mit einem ausreichend starken
          Auffälligkeitsmuster gefunden.
        </div>
      ) : (
        <>
          <h2>Zu prüfen</h2>
          {report.activeAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </>
      )}

      {report.resolvedAlerts.length > 0 && (
        <details className="admin-card" style={{ marginTop: 20 }}>
          <summary>
            <b>
              Bereits bearbeitete Auffälligkeiten (
              {report.resolvedAlerts.length})
            </b>
          </summary>

          <div style={{ marginTop: 16 }}>
            {report.resolvedAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                resolved
              />
            ))}
          </div>
        </details>
      )}
    </main>
  );
}
