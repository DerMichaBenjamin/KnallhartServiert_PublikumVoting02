'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Round } from '@/lib/releaseVotingShared';
import type { VotingSecurityAlert, VotingSecurityReport } from '@/lib/votingSecurityShared';
import { PageHeader } from '@/components/admin/AdminUi';

type Props = {
  round: Round;
  report: VotingSecurityReport;
};

type PendingVote = {
  voteId: string;
  name: string;
  email: string;
  createdAt: string;
  verifiedAt: string | null;
  isExcluded: boolean;
  domain: string;
  ipGroup: string | null;
};

type UiParticipant = {
  voteId: string;
  name: string;
  email: string;
  createdAt: string;
  verifiedAt: string | null;
  isExcluded: boolean;
  isVerified: boolean;
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

function participantStatus(participant: UiParticipant) {
  if (!participant.isVerified && participant.isExcluded) {
    return 'Unbestätigt · ausgeschlossen';
  }
  if (!participant.isVerified) return 'Unbestätigt';
  if (participant.isExcluded) return 'Bestätigt · ausgeschlossen';
  return 'Bestätigt · gewertet';
}

function pendingMatchesAlert(vote: PendingVote, alert: VotingSecurityAlert) {
  if (alert.kind === 'domain_cluster') {
    return Boolean(alert.domain) && vote.domain === alert.domain;
  }

  if (alert.kind === 'ip_cluster') {
    return Boolean(alert.ipGroup) && vote.ipGroup === alert.ipGroup;
  }

  if (alert.kind === 'time_cluster') {
    const created = Date.parse(vote.createdAt);
    const start = Date.parse(alert.windowStart || '');
    const end = Date.parse(alert.windowEnd || '');
    if (!Number.isFinite(created) || !Number.isFinite(start) || !Number.isFinite(end)) {
      return false;
    }
    return created >= start && created <= end;
  }

  return false;
}

export default function AdminVotingSecurity({ round, report }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [selectedVoteIds, setSelectedVoteIds] = useState<string[]>([]);
  const [pendingVotes, setPendingVotes] = useState<PendingVote[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPending() {
      setPendingLoading(true);
      try {
        const response = await fetch('/api/admin/security-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roundId: round.id }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || 'Unbestätigte Stimmen konnten nicht geladen werden.');
        }
        if (!cancelled) {
          setPendingVotes(Array.isArray(data.votes) ? data.votes : []);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({
            type: 'error',
            text: error instanceof Error ? error.message : 'Unbestätigte Stimmen konnten nicht geladen werden.',
          });
        }
      } finally {
        if (!cancelled) setPendingLoading(false);
      }
    }

    void loadPending();
    return () => {
      cancelled = true;
    };
  }, [round.id]);

  function participantsForAlert(alert: VotingSecurityAlert): UiParticipant[] {
    const map = new Map<string, UiParticipant>();

    for (const participant of alert.participants) {
      map.set(participant.voteId, {
        voteId: participant.voteId,
        name: participant.name,
        email: participant.email,
        createdAt: participant.createdAt,
        verifiedAt: participant.verifiedAt,
        isExcluded: participant.isExcluded,
        isVerified: true,
      });
    }

    for (const vote of pendingVotes) {
      if (!pendingMatchesAlert(vote, alert)) continue;
      map.set(vote.voteId, {
        voteId: vote.voteId,
        name: vote.name,
        email: vote.email,
        createdAt: vote.createdAt,
        verifiedAt: vote.verifiedAt,
        isExcluded: vote.isExcluded,
        isVerified: false,
      });
    }

    return [...map.values()].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
    );
  }

  const participantById = useMemo(() => {
    const map = new Map<string, UiParticipant>();

    for (const alert of [...report.activeAlerts, ...report.resolvedAlerts]) {
      for (const participant of alert.participants) {
        map.set(participant.voteId, {
          voteId: participant.voteId,
          name: participant.name,
          email: participant.email,
          createdAt: participant.createdAt,
          verifiedAt: participant.verifiedAt,
          isExcluded: participant.isExcluded,
          isVerified: true,
        });
      }

      for (const vote of pendingVotes) {
        if (!pendingMatchesAlert(vote, alert)) continue;
        map.set(vote.voteId, {
          voteId: vote.voteId,
          name: vote.name,
          email: vote.email,
          createdAt: vote.createdAt,
          verifiedAt: vote.verifiedAt,
          isExcluded: vote.isExcluded,
          isVerified: false,
        });
      }
    }

    return map;
  }, [report, pendingVotes]);

  const selectedParticipants = selectedVoteIds
    .map((voteId) => participantById.get(voteId))
    .filter(Boolean) as UiParticipant[];

  const selectedOpenIds = selectedParticipants
    .filter((participant) => !participant.isExcluded)
    .map((participant) => participant.voteId);

  const selectedExcludedIds = selectedParticipants
    .filter((participant) => participant.isExcluded)
    .map((participant) => participant.voteId);

  const selectedPendingCount = selectedParticipants.filter(
    (participant) => !participant.isVerified
  ).length;

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

  async function changeMany(voteIds: string[], excluded: boolean, reason: string) {
    for (let index = 0; index < voteIds.length; index += 4) {
      const chunk = voteIds.slice(index, index + 4);
      await Promise.all(
        chunk.map((voteId) => setVoteExcluded(voteId, excluded, reason))
      );
    }
  }

  async function updateSelected(excluded: boolean) {
    const voteIds = excluded ? selectedOpenIds : selectedExcludedIds;

    if (!voteIds.length) {
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
        `Grund für den Ausschluss von ${voteIds.length} ausgewählten Stimmen:`,
        'Sicherheitsprüfung: manuelle Sammelauswahl'
      ) ?? '';
      if (!reason.trim()) return;
    }

    const question = excluded
      ? `${voteIds.length} ausgewählte Stimmen ausschließen? Unbestätigte Stimmen bleiben auch ausgeschlossen, falls sie später per E-Mail bestätigt werden.`
      : `${voteIds.length} ausgewählte Stimmen wieder zulassen?`;

    if (!window.confirm(question)) return;

    setBusy(true);
    setMessage(null);
    try {
      await changeMany(voteIds, excluded, reason);
      setMessage({ type: 'ok', text: `${voteIds.length} Stimmen wurden geändert.` });
      clearSelected();
      setPendingVotes((current) => current.map((vote) => voteIds.includes(vote.voteId) ? { ...vote, isExcluded: excluded } : vote));
      router.refresh();
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
    const participants = participantsForAlert(alert);
    const voteIds = participants
      .filter((participant) => excluded ? !participant.isExcluded : participant.isExcluded)
      .map((participant) => participant.voteId);

    if (!voteIds.length) return;

    let reason = '';
    if (excluded) {
      reason = window.prompt(
        'Grund für den Ausschluss dieser auffälligen Gruppe:',
        `Sicherheitsprüfung: ${alert.title}`
      ) ?? '';
      if (!reason.trim()) return;
    }

    const question = excluded
      ? `${voteIds.length} noch nicht ausgeschlossene Stimmen dieser Gruppe ausschließen? Dazu können auch unbestätigte Stimmen gehören. Sie bleiben gespeichert und würden auch nach einer späteren Mail-Bestätigung nicht gewertet.`
      : `${voteIds.length} ausgeschlossene Stimmen dieser Gruppe wieder zulassen?`;

    if (!window.confirm(question)) return;

    setBusy(true);
    setMessage(null);
    try {
      await changeMany(voteIds, excluded, reason);
      setMessage({ type: 'ok', text: 'Änderung gespeichert.' });
      setPendingVotes((current) => current.map((vote) => voteIds.includes(vote.voteId) ? { ...vote, isExcluded: excluded } : vote));
      router.refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unbekannter Fehler.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function updateSingle(participant: UiParticipant, excluded: boolean, alertTitle: string) {
    const question = excluded
      ? participant.isVerified
        ? 'Diese bestätigte Stimme aus der offiziellen Wertung ausschließen?'
        : 'Diese unbestätigte Stimme schon jetzt ausschließen? Falls sie später bestätigt wird, bleibt sie ausgeschlossen.'
      : 'Diese Stimme wieder zulassen?';

    if (!window.confirm(question)) return;

    const reason = excluded ? `Sicherheitsprüfung: ${alertTitle}` : '';

    setBusy(true);
    setMessage(null);
    try {
      await setVoteExcluded(participant.voteId, excluded, reason);
      setMessage({ type: 'ok', text: 'Änderung gespeichert.' });
      setPendingVotes((current) => current.map((vote) => vote.voteId === participant.voteId ? { ...vote, isExcluded: excluded } : vote));
      router.refresh();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unbekannter Fehler.',
      });
    } finally {
      setBusy(false);
    }
  }

  function renderAlertCard(alert: VotingSecurityAlert, resolved = false) {
    const participants = participantsForAlert(alert);
    const verifiedCounted = participants.filter(
      (participant) => participant.isVerified && !participant.isExcluded
    );
    const pendingOpen = participants.filter(
      (participant) => !participant.isVerified && !participant.isExcluded
    );
    const excludedParticipants = participants.filter(
      (participant) => participant.isExcluded
    );

    return (
      <section className="admin-card" key={alert.id}>
        <div className="action-cell" style={{ justifyContent: 'space-between' }}>
          <div>
            <small>{levelLabel(alert.level)}</small>
            <h2 style={{ marginTop: 4 }}>{alert.title}</h2>
          </div>
          <b>
            {alert.voteCount} bestätigt
            {pendingOpen.length > 0 ? ` + ${pendingOpen.length} unbestätigt` : ''}
          </b>
        </div>

        <p>{alert.description}</p>

        <div className="admin-stats-grid">
          <div className="stat-card"><small>Ziel-Song im Muster</small><b>{alert.targetSong || '—'}</b></div>
          <div className="stat-card"><small>Song gewählt</small><b>{metric(alert.selectionPct, '%')}</b></div>
          <div className="stat-card"><small>Ø Punkte Gruppe</small><b>{metric(alert.averagePoints)}</b></div>
          <div className="stat-card"><small>Ø übriges Publikum</small><b>{metric(alert.baselineAveragePoints)}</b></div>
          <div className="stat-card"><small>Punkte-Abweichung</small><b>{alert.pointsLift == null ? '—' : `${alert.pointsLift >= 0 ? '+' : ''}${alert.pointsLift}`}</b></div>
          <div className="stat-card"><small>Noch gewertet</small><b>{verifiedCounted.length}</b></div>
          <div className="stat-card"><small>Noch unbestätigt</small><b>{pendingOpen.length}</b></div>
        </div>

        <p className="admin-help-text">
          {alert.domain ? <>Mail-Domain: <b>{alert.domain}</b> · </> : null}
          {alert.ipGroup ? <>anonymisierte Anschluss-Gruppe: <b>{alert.ipGroup}</b> · </> : null}
          Zeitraum: {formatAdminDateTime(alert.windowStart)} bis {formatAdminDateTime(alert.windowEnd)}
        </p>

        <div className="action-cell">
          {participants.some((participant) => !participant.isExcluded) && (
            <button type="button" disabled={busy} onClick={() => updateGroup(alert, true)}>
              Noch nicht ausgeschlossene Gruppe ausschließen
            </button>
          )}
          {(resolved || excludedParticipants.length > 0) && excludedParticipants.length > 0 && (
            <button type="button" disabled={busy} onClick={() => updateGroup(alert, false)}>
              Gruppe wieder zulassen
            </button>
          )}
        </div>

        <details style={{ marginTop: 16 }}>
          <summary>Betroffene Stimmen ansehen</summary>

          <div className="admin-card" style={{ marginTop: 12, padding: 14, boxShadow: 'none' }}>
            <div className="action-cell" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {verifiedCounted.length > 0 && (
                <button type="button" disabled={busy} onClick={() => addSelected(verifiedCounted.map((participant) => participant.voteId))}>
                  Alle gewerteten markieren
                </button>
              )}
              {pendingOpen.length > 0 && (
                <button type="button" disabled={busy} onClick={() => addSelected(pendingOpen.map((participant) => participant.voteId))}>
                  Alle unbestätigten markieren
                </button>
              )}
              {excludedParticipants.length > 0 && (
                <button type="button" disabled={busy} onClick={() => addSelected(excludedParticipants.map((participant) => participant.voteId))}>
                  Alle ausgeschlossenen markieren
                </button>
              )}
              <button type="button" disabled={busy || selectedVoteIds.length === 0} onClick={clearSelected}>
                Auswahl aufheben
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <b>{selectedVoteIds.length} Stimmen ausgewählt</b>
            </div>

            {selectedVoteIds.length > 0 && (
              <div className="action-cell" style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy || selectedOpenIds.length === 0} onClick={() => updateSelected(true)}>
                  Ausgewählte ausschließen ({selectedOpenIds.length})
                </button>
                <button type="button" disabled={busy || selectedExcludedIds.length === 0} onClick={() => updateSelected(false)}>
                  Ausgewählte wieder zulassen ({selectedExcludedIds.length})
                </button>
              </div>
            )}
          </div>

          <div className="admin-table-wrap compact" style={{ marginTop: 12, maxHeight: 420, overflow: 'auto' }}>
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
                {participants.map((participant) => (
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
                    <td>{participant.email || '—'}</td>
                    <td>{formatAdminDateTime(participant.createdAt)}</td>
                    <td>{formatAdminDateTime(participant.verifiedAt)}</td>
                    <td>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => updateSingle(participant, !participant.isExcluded, alert.title)}
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
              </tbody>
            </table>
          </div>
        </details>
      </section>
    );
  }

  return (
    <main>
      <PageHeader eyebrow={<a href={`/admin/release-voting/${round.id}`}>← Zur Umfrage</a>} title={`Voting-Prüfung – ${round.title}`} description="Auffällige Stimmen prüfen und bewusst werten oder ausschließen. Es wird nichts automatisch ausgeschlossen." />

      {message && <div className={`notice ${message.type === 'ok' ? 'success' : 'error'}`}>{message.text}</div>}
      {busy && <div className="notice">Speichert…</div>}
      {pendingLoading && <div className="notice">Unbestätigte Stimmen der auffälligen Gruppen werden geladen…</div>}

      {selectedVoteIds.length > 0 && (
        <div className="notice">
          <b>{selectedVoteIds.length} Stimmen ausgewählt.</b>{' '}
          {selectedOpenIds.length} noch nicht ausgeschlossen · {selectedExcludedIds.length} ausgeschlossen
          {selectedPendingCount > 0 ? ` · ${selectedPendingCount} unbestätigt` : ''}.
        </div>
      )}

      <section className="admin-stats-grid">
        <div className="stat-card"><small>Bestätigte Stimmen geprüft</small><b>{report.verifiedVotes}</b></div>
        <div className="stat-card"><small>Aktiv gewertet</small><b>{report.countedVotes}</b></div>
        <div className="stat-card"><small>Offene Auffälligkeiten</small><b>{report.activeAlerts.length}</b></div>
        <div className="stat-card"><small>Mit IP-Hash erfasst</small><b>{report.trackedVerifiedVotes}</b></div>
      </section>

      <section className="admin-card">
        <h2>Technischer Prüfstatus</h2>
        {report.trackingConfigured && report.ipColumnAvailable ? (
          <p>Aktiv. Gespeichert wird nur ein pro Abstimmungsrunde erzeugter Hash, keine Klartext-IP.</p>
        ) : (
          <p>
            Noch nicht vollständig aktiv.
            {!report.ipColumnAvailable ? ' Die Supabase-Spalte ip_hash fehlt.' : ''}
            {!report.trackingConfigured ? ' VOTING_IP_HASH_SECRET ist in diesem laufenden Deployment nicht verfügbar. Prüfe in Vercel die Zuordnung zu Production/Preview und führe anschließend einen Redeploy aus.' : ''}
          </p>
        )}
      </section>

      <section className="admin-card">
        <h2>Umgang mit unbestätigten auffälligen Stimmen</h2>
        <p>
          Unbestätigte Stimmen einer bereits erkannten auffälligen Domain-, Anschluss- oder Zeitgruppe werden in den jeweiligen Gruppen mit angezeigt. Du kannst sie schon vor der Mail-Bestätigung ausschließen. Wird die Mail später bestätigt, bleibt <code>is_excluded</code> bestehen und die Stimme wird nicht gewertet.
        </p>
      </section>

      {report.errors.length > 0 && (
        <div className="notice error">Sicherheitsanalyse teilweise fehlgeschlagen: {report.errors.join(' · ')}</div>
      )}

      {report.activeAlerts.length === 0 ? (
        <div className="notice success">Aktuell keine noch gewerteten Stimmen mit einem ausreichend starken Auffälligkeitsmuster gefunden.</div>
      ) : (
        <>
          <h2>Stimmen müssen geprüft werden</h2>
          {report.activeAlerts.map((alert) => renderAlertCard(alert))}
        </>
      )}

      {report.resolvedAlerts.length > 0 && (
        <details className="admin-card" style={{ marginTop: 20 }}>
          <summary><b>Bereits bearbeitete Auffälligkeiten ({report.resolvedAlerts.length})</b></summary>
          <div style={{ marginTop: 16 }}>
            {report.resolvedAlerts.map((alert) => renderAlertCard(alert, true))}
          </div>
        </details>
      )}
    </main>
  );
}
