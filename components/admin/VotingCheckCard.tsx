'use client';

import { useEffect, useState } from 'react';

type CheckRow = {
  label: string;
  count: number | null;
  href: string;
  action: string;
};

export default function VotingCheckCard({
  roundId,
  reviewVotes,
  securityAlerts: initialSecurityAlerts,
  duplicateGroups,
  openJurors,
}: {
  roundId: string;
  reviewVotes: number;
  securityAlerts: number | null;
  duplicateGroups: number;
  openJurors: number;
}) {
  const [securityAlerts, setSecurityAlerts] = useState<number | null>(initialSecurityAlerts);
  const [securityFailed, setSecurityFailed] = useState(false);

  useEffect(() => {
    if (initialSecurityAlerts !== null) {
      setSecurityAlerts(initialSecurityAlerts);
      setSecurityFailed(false);
      return;
    }
    setSecurityAlerts(null);
    setSecurityFailed(false);
    let cancelled = false;
    void fetch(`/api/admin/security-summary?roundId=${encodeURIComponent(roundId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.ok || !Number.isFinite(Number(data.activeAlerts))) throw new Error('Security-Auswertung nicht verfügbar.');
        setSecurityAlerts(Number(data.activeAlerts));
      })
      .catch(() => { if (!cancelled) setSecurityFailed(true); });
    return () => { cancelled = true; };
  }, [initialSecurityAlerts, roundId]);

  const rows: CheckRow[] = [
    { label: 'Stimmen noch nicht gewertet', count: reviewVotes, href: `/admin/release-voting/${roundId}/votes?filter=review`, action: 'Prüfen' },
    { label: 'Security-Auffälligkeiten', count: securityAlerts, href: `/admin/release-voting/${roundId}/security`, action: 'Prüfen' },
    { label: 'Mögliche Doppler', count: duplicateGroups, href: `/admin/release-voting/${roundId}#duplicate-check`, action: 'Prüfen' },
    { label: 'Jury-Mitglieder noch offen', count: openJurors, href: `/admin/release-voting/${roundId}#jury`, action: 'Ansehen' },
  ];
  const openRows = rows.filter((row) => (row.count || 0) > 0);
  const total = rows.reduce((sum, row) => sum + (row.count || 0), 0);
  const securityPending = securityAlerts === null && !securityFailed;

  return (
    <section className={`ks-voting-check ${total || securityPending || securityFailed ? 'warning' : 'success'}`} id="voting-check">
      <div className="ks-voting-check-icon" aria-hidden="true">{securityPending ? '…' : total || securityFailed ? '!' : '✓'}</div>
      <div className="ks-voting-check-copy">
        <span className="ks-section-kicker">Voting-Prüfung</span>
        <h2>{securityPending ? (total ? `${total} bekannte Prüfpunkte · Security-Prüfung läuft` : 'Security-Prüfung läuft…') : total ? `${total} offene ${total === 1 ? 'Prüfaufgabe' : 'Prüfpunkte'}` : 'Keine offenen Voting-Probleme'}</h2>
        {(total || securityPending || securityFailed) ? <ul className="ks-voting-check-list">
          {rows.map((row) => <li key={row.label} className={row.count ? 'open' : 'clear'}>
            <span>{row.label}</span>
            <strong>{row.count === null ? (securityFailed ? '?' : '…') : row.count}</strong>
            {(row.count || 0) > 0 ? <a href={row.href}>{row.action}</a> : row.count === null ? <a href={row.href}>Öffnen</a> : <span aria-label="Keine offenen Punkte">✓</span>}
          </li>)}
        </ul> : <p>Security-Prüfung, Stimmenstatus, Songliste und Jury-Fortschritt zeigen aktuell keine offenen Punkte.</p>}
      </div>
      {!securityPending && !securityFailed && openRows.length === 1 && <a className="ks-button warning" href={openRows[0].href}>{openRows[0].action}</a>}
    </section>
  );
}
