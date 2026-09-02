'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Round, SongDuplicateGroup } from '@/lib/releaseVotingShared';
import type { AdminJuryJurorRow } from '@/lib/juryVoting';
import type { VotingCheckReviewVote } from '@/lib/releaseVoting';
import type { VotingSecurityAlert, VotingSecurityReport } from '@/lib/votingSecurityShared';
import { combineSongLine } from '@/lib/releaseVotingShared';
import { formatAdminDateTime } from '@/lib/adminUi';
import { StatusBadge } from './AdminUi';

type Props = {
  round: Round;
  reviewCount: number;
  reviewVotes: VotingCheckReviewVote[];
  securityReport: VotingSecurityReport;
  duplicateGroups: SongDuplicateGroup[];
  openJurors: AdminJuryJurorRow[];
};

export default function VotingChecksManager({ round, reviewCount, reviewVotes, securityReport, duplicateGroups, openJurors }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selectedReviewVotes, setSelectedReviewVotes] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const securityAlerts = securityReport.activeAlerts;
  const allReviewSelected = reviewVotes.length > 0 && reviewVotes.every((vote) => selectedReviewVotes.has(vote.id));

  async function request(url: string, body: unknown) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Die Aktion konnte nicht gespeichert werden.');
    return data;
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setSelectedReviewVotes(new Set());
      setMessage({ type: 'ok', text: success });
      router.refresh();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unbekannter Fehler.' });
    } finally {
      setBusy(false);
    }
  }

  function toggleReviewVote(voteId: string, checked: boolean) {
    setSelectedReviewVotes((current) => {
      const next = new Set(current);
      if (checked) next.add(voteId);
      else next.delete(voteId);
      return next;
    });
  }

  function setAllReviewVotes(checked: boolean) {
    setSelectedReviewVotes(checked ? new Set(reviewVotes.map((vote) => vote.id)) : new Set());
  }

  function updateReviewVotes(action: 'count' | 'exclude', voteIds: string[]) {
    if (!voteIds.length) return;
    const verb = action === 'count' ? 'werten' : 'ausschließen';
    if (!window.confirm(`${voteIds.length} ${voteIds.length === 1 ? 'Stimme' : 'Stimmen'} wirklich ${verb}?`)) return;
    void run(
      async () => { await request('/api/admin/vote-status', { voteIds, action }); },
      `${voteIds.length} ${voteIds.length === 1 ? 'Stimme wurde' : 'Stimmen wurden'} aktualisiert.`,
    );
  }

  function excludeSecurityVotes(alert: VotingSecurityAlert, voteIds: string[]) {
    if (!voteIds.length) return;
    const reason = window.prompt('Grund für den Ausschluss dieser auffälligen Stimmen:', `Sicherheitsprüfung: ${alert.title}`) ?? '';
    if (!reason.trim()) return;
    if (!window.confirm(`${voteIds.length} Stimmen dieser Security-Gruppe wirklich ausschließen?`)) return;
    void run(async () => {
      for (let index = 0; index < voteIds.length; index += 4) {
        await Promise.all(voteIds.slice(index, index + 4).map((voteId) =>
          request('/api/admin/vote-exclusion', { voteId, excluded: true, reason })
        ));
      }
    }, `${voteIds.length} Security-Stimmen wurden ausgeschlossen.`);
  }

  function mergeSongs(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const targetSongId = String(form.get('targetSongId') || '');
    const sourceSongId = String(form.get('sourceSongId') || '');
    if (!targetSongId || !sourceSongId || targetSongId === sourceSongId) {
      setMessage({ type: 'error', text: 'Bitte zwei unterschiedliche Songs auswählen.' });
      return;
    }
    const target = String(form.get('targetLabel') || 'den Ziel-Song');
    const source = String(form.get('sourceLabel') || 'den Doppler');
    if (!window.confirm(`„${source}“ wirklich in „${target}“ zusammenführen? Der doppelte Quelldatensatz wird danach entfernt.`)) return;
    void run(
      async () => { await request('/api/admin/merge-songs', { roundId: round.id, targetSongId, sourceSongId }); },
      'Die Songs wurden zusammengeführt.',
    );
  }

  function copyJuryLink(juror: AdminJuryJurorRow) {
    void navigator.clipboard?.writeText(`${window.location.origin}/jury-voting/${juror.access_token}`);
    setMessage({ type: 'ok', text: `Jury-Link für ${juror.display_name} kopiert.` });
  }

  function newJuryLink(juror: AdminJuryJurorRow) {
    if (!window.confirm(`Neuen persönlichen Link für ${juror.display_name} erzeugen? Der bisherige Link wird sofort ungültig.`)) return;
    void run(
      async () => { await request('/api/admin/jury', { action: 'new-link', roundId: round.id, jurorId: juror.id }); },
      `Neuer Jury-Link für ${juror.display_name} wurde erzeugt.`,
    );
  }

  function removeJuror(juror: AdminJuryJurorRow) {
    if (!window.confirm(`${juror.display_name} aus dieser Umfrage entfernen? Eine eventuell vorhandene Jury-Stimme wird dabei ebenfalls gelöscht.`)) return;
    void run(
      async () => { await request('/api/admin/jury', { action: 'remove-juror', roundId: round.id, jurorId: juror.id }); },
      `${juror.display_name} wurde entfernt.`,
    );
  }

  return <>
    {message && <div className={`notice ${message.type === 'ok' ? 'success' : 'error'}`}>{message.text}</div>}
    {busy && <div className="notice">Änderung wird gespeichert…</div>}

    <section className="ks-checks-grid" aria-label="Prüfbereiche">
      <article className={`ks-card ks-check-detail ${reviewCount ? 'warning' : 'success'}`} id="review-votes">
        <header>
          <div><span className="ks-check-number">1</span><div><span className="ks-section-kicker">Publikumsstimmen</span><h2>Stimmen noch nicht gewertet</h2></div></div>
          <StatusBadge status={reviewCount ? 'warning' : 'success'}>{reviewCount ? `${reviewCount} prüfen` : 'Keine offen'}</StatusBadge>
        </header>
        {reviewVotes.length ? <>
          <div className="ks-check-bulk">
            <label><input type="checkbox" checked={allReviewSelected} onChange={(event) => setAllReviewVotes(event.target.checked)} /> Alle angezeigten auswählen</label>
            <div><button className="ks-button small success" type="button" disabled={busy || !selectedReviewVotes.size} onClick={() => updateReviewVotes('count', [...selectedReviewVotes])}>Auswahl werten</button><button className="ks-button small danger" type="button" disabled={busy || !selectedReviewVotes.size} onClick={() => updateReviewVotes('exclude', [...selectedReviewVotes])}>Auswahl ausschließen</button></div>
          </div>
          <div className="ks-direct-review-list">
            {reviewVotes.map((vote) => <div key={vote.id}>
              <input type="checkbox" checked={selectedReviewVotes.has(vote.id)} onChange={(event) => toggleReviewVote(vote.id, event.target.checked)} aria-label={`Stimme von ${vote.juror_email || vote.juror_name} auswählen`} />
              <div><strong>{vote.juror_name || 'Ohne Namen'}</strong><a href={`mailto:${vote.juror_email}`}>{vote.juror_email}</a><small>{formatAdminDateTime(vote.created_at)}{vote.integrity_reasons?.length ? ` · ${vote.integrity_reasons.join(' · ')}` : ''}</small></div>
              <div><button className="ks-button small success" type="button" disabled={busy} onClick={() => updateReviewVotes('count', [vote.id])}>Werten</button><button className="ks-button small danger" type="button" disabled={busy} onClick={() => updateReviewVotes('exclude', [vote.id])}>Ausschließen</button></div>
            </div>)}
          </div>
          {reviewCount > reviewVotes.length && <p className="ks-check-limit-note">Es werden die neuesten {reviewVotes.length} von {reviewCount} Stimmen angezeigt. Die vollständige Liste bleibt in der Publikumsverwaltung verfügbar.</p>}
        </> : <p>Aktuell wartet keine bestätigte Publikumsstimme auf eine Entscheidung.</p>}
        <a className="ks-button secondary" href={`/admin/release-voting/${round.id}/votes?filter=review`}>Vollständige Publikumsverwaltung</a>
      </article>

      <article className={`ks-card ks-check-detail ${securityAlerts.length ? 'danger' : 'success'}`} id="security-alerts">
        <header>
          <div><span className="ks-check-number">2</span><div><span className="ks-section-kicker">Fraud- und Integritätsprüfung</span><h2>Security-Auffälligkeiten</h2></div></div>
          <StatusBadge status={securityAlerts.length ? 'danger' : 'success'}>{securityAlerts.length ? `${securityAlerts.length} prüfen` : 'Keine offen'}</StatusBadge>
        </header>
        {!securityReport.trackingConfigured && <div className="ks-inline-notice warning">VOTING_IP_HASH_SECRET ist in diesem Deployment nicht verfügbar.</div>}
        {!securityReport.ipColumnAvailable && <div className="ks-inline-notice warning">Die Supabase-Spalte <code>ip_hash</code> ist nicht verfügbar.</div>}
        {securityReport.errors.length > 0 && <div className="ks-inline-notice danger">Security-Auswertung teilweise fehlgeschlagen: {securityReport.errors.join(' · ')}</div>}
        {securityAlerts.length ? <div className="ks-security-check-list">
          {securityAlerts.map((alert) => <section key={alert.id}>
            <div className="ks-security-check-head"><div><strong>{alert.title}</strong><p>{alert.description}</p></div><StatusBadge status={alert.level === 'high' ? 'danger' : 'warning'}>{alert.voteCount} Stimmen</StatusBadge></div>
            <ul>{alert.participants.filter((participant) => !participant.isExcluded).map((participant) => <li key={participant.voteId}><span><b>{participant.name || 'Ohne Namen'}</b><small>{participant.email} · {formatAdminDateTime(participant.createdAt)}</small></span><button className="ks-button small danger" type="button" disabled={busy} onClick={() => excludeSecurityVotes(alert, [participant.voteId])}>Ausschließen</button></li>)}</ul>
            <button className="ks-button danger" type="button" disabled={busy || !alert.countedVoteIds.length} onClick={() => excludeSecurityVotes(alert, alert.countedVoteIds)}>Offene Gruppe ausschließen</button>
          </section>)}
        </div> : <p>Die bestehende Security-Analyse meldet aktuell keine offene Domain-, Anschluss- oder Zeitgruppen-Auffälligkeit.</p>}
        <a className="ks-button secondary" href={`/admin/release-voting/${round.id}/security`}>Erweiterte Security-Ansicht</a>
      </article>

      <article className={`ks-card ks-check-detail ${duplicateGroups.length ? 'warning' : 'success'}`} id="duplicate-songs">
        <header>
          <div><span className="ks-check-number">3</span><div><span className="ks-section-kicker">Songdaten</span><h2>Mögliche Doppler</h2></div></div>
          <StatusBadge status={duplicateGroups.length ? 'warning' : 'success'}>{duplicateGroups.length ? `${duplicateGroups.length} prüfen` : 'Keine erkannt'}</StatusBadge>
        </header>
        {duplicateGroups.length ? <div className="ks-direct-duplicates">
          {duplicateGroups.map((group) => <form key={group.key} onSubmit={mergeSongs}>
            <strong>{group.kind === 'exact' ? 'Exakter Doppler' : 'Möglicher Doppler'}</strong>
            <div className="ks-form-row two">
              <label>Song behalten<select name="targetSongId" defaultValue={group.songs[0]?.id} onChange={(event) => { const input = event.currentTarget.form?.elements.namedItem('targetLabel') as HTMLInputElement | null; if (input) input.value = event.currentTarget.selectedOptions[0]?.text || ''; }}>{group.songs.map((song) => <option key={song.id} value={song.id}>{combineSongLine(song)}</option>)}</select></label>
              <label>Doppler zusammenführen<select name="sourceSongId" defaultValue={group.songs[1]?.id} onChange={(event) => { const input = event.currentTarget.form?.elements.namedItem('sourceLabel') as HTMLInputElement | null; if (input) input.value = event.currentTarget.selectedOptions[0]?.text || ''; }}>{group.songs.map((song) => <option key={song.id} value={song.id}>{combineSongLine(song)}</option>)}</select></label>
            </div>
            <input type="hidden" name="targetLabel" defaultValue={combineSongLine(group.songs[0])} />
            <input type="hidden" name="sourceLabel" defaultValue={combineSongLine(group.songs[1])} />
            <button className="ks-button danger" type="submit" disabled={busy}>Ausgewählte Songs zusammenführen</button>
          </form>)}
        </div> : <p>Die vorhandene Dopplererkennung findet in dieser Umfrage aktuell keine zusammengehörigen Songdatensätze.</p>}
        <a className="ks-button secondary" href={`/admin/release-voting/${round.id}#duplicate-check`}>Vollständige Songverwaltung</a>
      </article>

      <article className={`ks-card ks-check-detail ${openJurors.length ? 'warning' : 'success'}`} id="open-jury">
        <header>
          <div><span className="ks-check-number">4</span><div><span className="ks-section-kicker">Jury-Fortschritt</span><h2>Offene Jury-Mitglieder</h2></div></div>
          <StatusBadge status={openJurors.length ? 'warning' : 'success'}>{openJurors.length ? `${openJurors.length} offen` : 'Jury vollständig'}</StatusBadge>
        </header>
        {openJurors.length ? <div className="ks-direct-jury-list">
          {openJurors.map((juror) => <div key={juror.id}>
            <div><strong>{juror.display_name}</strong><span>{juror.items.length}/12 Platzierungen gespeichert · noch nicht abgegeben</span></div>
            <div><a className="ks-button small secondary" href={`/jury-voting/${juror.access_token}`} target="_blank" rel="noreferrer">Jury-Seite öffnen</a><button className="ks-button small secondary" type="button" onClick={() => copyJuryLink(juror)}>Link kopieren</button><button className="ks-button small secondary" type="button" disabled={busy} onClick={() => newJuryLink(juror)}>Neuer Link</button><button className="ks-button small danger" type="button" disabled={busy} onClick={() => removeJuror(juror)}>Entfernen</button></div>
          </div>)}
        </div> : <p>Alle aktiven Jury-Mitglieder haben ihre Wertung vollständig abgegeben.</p>}
        <a className="ks-button secondary" href={`/admin/release-voting/${round.id}#jury`}>Vollständige Juryverwaltung</a>
      </article>
    </section>
  </>;
}
