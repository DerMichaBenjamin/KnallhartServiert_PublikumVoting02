import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getReleaseStatisticsArchive } from '@/lib/releaseStatistics';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import StatisticsOverview from '@/components/admin/StatisticsOverview';

export const dynamic = 'force-dynamic';

export default async function AdminStatisticsPage() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const archive = await getReleaseStatisticsArchive();
  const totals = archive.totals;

  return <main>
    <PageHeader title="Statistiken" description="Aktuelle Woche, historische Vergleiche und Künstlerhistorie auf Basis der vorhandenen Votingdaten." actions={<><a className="ks-button secondary" href="/api/admin/statistics/export?scope=all&format=csv">Gesamtauswertung CSV</a><a className="ks-button primary" href="/api/admin/statistics/export?scope=all&format=xlsx">Gesamtauswertung XLSX</a></>} />
    <section className="ks-stats-grid dashboard">
      <StatCard label="Umfragen/Datenbankeinträge" value={totals.databaseRounds} hint={`${totals.conductedRounds} tatsächlich durchgeführt`} tone="violet" />
      <StatCard label="Songs insgesamt" value={totals.songsCount} />
      <StatCard label="Stimmen insgesamt" value={totals.totalVotes} />
      <StatCard label="Gewertet" value={totals.countedVotes} tone="success" />
      <StatCard label="Nicht bestätigt" value={totals.unverifiedVotes} tone="warning" />
      <StatCard label="In Prüfung" value={totals.reviewVotes} tone="warning" />
      <StatCard label="Ausgeschlossen" value={totals.excludedVotes} tone="danger" />
    </section>
    <StatisticsOverview weeks={archive.weeks} artists={archive.artists} />
  </main>;
}
