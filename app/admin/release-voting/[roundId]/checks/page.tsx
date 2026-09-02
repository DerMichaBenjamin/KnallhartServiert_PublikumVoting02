import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminJuryRoundData } from '@/lib/juryVoting';
import { getRoundById, getRoundVoteCounts, getSongs, getVotingCheckReviewVotes } from '@/lib/releaseVoting';
import { findSongDuplicateGroups } from '@/lib/releaseVotingShared';
import { getVotingSecurityReport } from '@/lib/votingSecurity';
import { formatRoundPeriod } from '@/lib/adminUi';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import VotingChecksManager from '@/components/admin/VotingChecksManager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function VotingChecksPage({ params }: { params: Promise<{ roundId: string }> }) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const { roundId } = await params;
  const [round, voteCounts, reviewVotes, songs, juryData, securityReport] = await Promise.all([
    getRoundById(roundId),
    getRoundVoteCounts(roundId),
    getVotingCheckReviewVotes(roundId),
    getSongs(roundId),
    getAdminJuryRoundData(roundId),
    getVotingSecurityReport(roundId),
  ]);
  if (!round) notFound();

  const duplicateGroups = findSongDuplicateGroups(songs);
  const openJurors = juryData.jurors.filter((juror) => juror.is_active && !juror.submitted_at);
  const securityAlerts = securityReport.activeAlerts;
  const total = voteCounts.reviewVotes + securityAlerts.length + duplicateGroups.length + openJurors.length;

  return <main>
    <PageHeader
      eyebrow={<a href={`/admin/release-voting/${round.id}`}>← Zur Umfrage</a>}
      title={`Voting-Prüfung – ${round.title}`}
      description={`${formatRoundPeriod(round)} · Alle offenen Prüfpunkte an einer Stelle`}
    />

    <section className="ks-stats-grid overview">
      <StatCard label="Offene Prüfpunkte" value={total} tone={total ? 'warning' : 'success'} />
      <StatCard label="Stimmen nicht gewertet" value={voteCounts.reviewVotes} tone={voteCounts.reviewVotes ? 'warning' : 'success'} />
      <StatCard label="Security-Auffälligkeiten" value={securityAlerts.length} tone={securityAlerts.length ? 'danger' : 'success'} />
      <StatCard label="Mögliche Doppler" value={duplicateGroups.length} tone={duplicateGroups.length ? 'warning' : 'success'} />
      <StatCard label="Jury noch offen" value={openJurors.length} tone={openJurors.length ? 'warning' : 'success'} />
    </section>

    {!total && <div className="notice success"><b>✓ Keine offenen Voting-Probleme.</b> Stimmenstatus, Security-Prüfung, Songliste und Jury-Fortschritt sind aktuell ohne offenen Prüfpunkt.</div>}

    <VotingChecksManager
      round={round}
      reviewCount={voteCounts.reviewVotes}
      reviewVotes={reviewVotes}
      securityReport={securityReport}
      duplicateGroups={duplicateGroups}
      openJurors={openJurors}
    />
  </main>;
}
