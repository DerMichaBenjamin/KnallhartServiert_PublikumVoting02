'use client';

import { useMemo } from 'react';
import type { Round, AdminRoundSummary, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { findSongDuplicateGroups } from '@/lib/releaseVotingShared';
import { formatRoundPeriod, getAdminRoundStatus, adminRoundStatusLabel } from '@/lib/adminUi';
import { PageHeader, StatCard, StatusBadge, EmptyState } from '@/components/admin/AdminUi';
import VotingCheckCard from '@/components/admin/VotingCheckCard';
import Top5GraphicGenerator from '@/components/Top5GraphicGenerator';

type Props = {
  currentRound: Round | null;
  currentSongs: Song[];
  currentSummary: AdminRoundSummary | null;
  currentJuryData: AdminJuryRoundData;
  securityAlerts: number | null;
};

function QuickAction({ href, title, text, accent = false }: { href: string; title: string; text: string; accent?: boolean }) {
  return <a className={`ks-quick-action ${accent ? 'accent' : ''}`} href={href}><strong>{title}</strong><span>{text}</span><b aria-hidden="true">→</b></a>;
}

export default function AdminDashboard({ currentRound, currentSongs, currentSummary, currentJuryData, securityAlerts }: Props) {
  const activeJurors = useMemo(() => currentJuryData.jurors.filter((juror) => juror.is_active), [currentJuryData]);
  const submittedJurors = activeJurors.filter((juror) => Boolean(juror.submitted_at));
  const duplicateGroups = useMemo(() => findSongDuplicateGroups(currentSongs), [currentSongs]);
  const openJurors = activeJurors.length - submittedJurors.length;
  const openCheckItems = currentSummary
    ? currentSummary.reviewVotes + (securityAlerts || 0) + duplicateGroups.length + openJurors
    : 0;

  return (
    <main>
      <PageHeader title="Dashboard" description="Aktueller Status und die nächsten Arbeitsschritte." />

      {!currentRound || !currentSummary ? (
        <section className="ks-card">
          <EmptyState title="Keine aktuelle Umfrage" text="Lege eine neue Umfrage an oder markiere eine vorhandene Umfrage als aktuelle Haupt-Abstimmung." action={<a className="ks-button primary" href="/admin/rounds/new">Neue Umfrage</a>} />
        </section>
      ) : (
        <>
          <section className="ks-current-round-card">
            <div className="ks-current-round-copy">
              <StatusBadge status={getAdminRoundStatus(currentRound)}>{adminRoundStatusLabel(getAdminRoundStatus(currentRound))}</StatusBadge>
              <span className="ks-section-kicker">Aktuelle Umfrage</span>
              <h2>{currentRound.title}</h2>
              <p>{formatRoundPeriod(currentRound)}</p>
              <div className="ks-inline-actions">
                <a className="ks-button primary" href={`/admin/release-voting/${currentRound.id}`}>Zur aktuellen Umfrage</a>
                <a className="ks-button ghost-on-dark" href="/admin/rounds/new">Neue Umfrage</a>
              </div>
            </div>
            <div className="ks-current-round-side">
              <span>Jury-Fortschritt</span>
              <strong>{submittedJurors.length}/{activeJurors.length}</strong>
              <div className="ks-progress"><i style={{ width: `${activeJurors.length ? Math.round((submittedJurors.length / activeJurors.length) * 100) : 0}%` }} /></div>
              <small>{openJurors ? `${openJurors} noch offen` : 'Jury vollständig'}</small>
            </div>
          </section>

          <section className="ks-stats-grid dashboard">
            <StatCard label="Songs" value={currentSummary.songsCount} />
            <StatCard label="Jury-Mitglieder" value={activeJurors.length} />
            <StatCard label="Jury abgegeben" value={submittedJurors.length} tone={openJurors ? 'warning' : 'success'} />
            <StatCard label="Publikumsstimmen" value={currentSummary.totalVotes} />
            <StatCard label="Gewertet" value={currentSummary.countedVotes} tone="success" />
            <StatCard label="Nicht bestätigt" value={currentSummary.unverifiedVotes} tone="warning" />
            <StatCard label="Ausgeschlossen" value={currentSummary.excludedVotes} tone="danger" />
          </section>

          <section className="ks-section-block">
            <div className="ks-section-heading"><div><span className="ks-section-kicker">Direkte Arbeitswege</span><h2>Schnellzugriff</h2></div></div>
            <div className="ks-quick-grid">
              <QuickAction href={`/admin/release-voting/${currentRound.id}#jury`} title="Jury-Voting aktuell" text={`${submittedJurors.length} von ${activeJurors.length} abgegeben`} />
              <QuickAction href={`/admin/release-voting/${currentRound.id}/votes`} title="Publikums-Voting aktuell" text={`${currentSummary.countedVotes} von ${currentSummary.totalVotes} gewertet`} />
              <QuickAction href={`/admin/release-voting/${currentRound.id}/results#public-results`} title="Statistikanalyse aktuelles Voting" text="Publikum, Jury und Gesamtwertung" />
              <QuickAction href={`/admin/release-voting/${currentRound.id}/checks`} title="Voting-Prüfung" text={securityAlerts === null ? (openCheckItems ? `${openCheckItems} bekannte Prüfpunkte` : 'Prüfstatus öffnen') : openCheckItems ? `${openCheckItems} offene Prüfpunkte` : 'Keine offenen Prüfpunkte'} accent={openCheckItems > 0} />
            </div>
          </section>

          <VotingCheckCard roundId={currentRound.id} reviewVotes={currentSummary.reviewVotes} securityAlerts={securityAlerts} duplicateGroups={duplicateGroups.length} openJurors={openJurors} />

          <Top5GraphicGenerator round={currentRound} songs={currentSongs} publicLeaderboard={currentSummary.leaderboard} publicVerifiedVotes={currentSummary.countedVotes} juryData={currentJuryData} variant="compact" />
        </>
      )}
    </main>
  );
}
