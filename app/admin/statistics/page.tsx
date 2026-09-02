import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminOverviewTotals, getAdminRoundsPage } from '@/lib/adminOverview';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import StatisticsOverview from '@/components/admin/StatisticsOverview';

export const dynamic = 'force-dynamic';

export default async function AdminStatisticsPage() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const [totals, recent] = await Promise.all([
    getAdminOverviewTotals(),
    getAdminRoundsPage({ page: 1, pageSize: 20 }),
  ]);

  return <main>
    <PageHeader title="Statistiken" description="Tatsächliche Kennzahlen aus allen vorhandenen Umfragen." />
    <section className="ks-stats-grid dashboard">
      <StatCard label="Datenbankeinträge" value={totals.databaseRounds} hint={`${totals.conductedRounds} mit Votingaktivität`} tone="violet" />
      <StatCard label="Songs insgesamt" value={totals.songsCount} />
      <StatCard label="Stimmen insgesamt" value={totals.totalVotes} />
      <StatCard label="Gewertet" value={totals.countedVotes} tone="success" />
      <StatCard label="Nicht bestätigt" value={totals.unverifiedVotes} tone="warning" />
      <StatCard label="In Prüfung" value={totals.reviewVotes} tone="warning" />
      <StatCard label="Ausgeschlossen" value={totals.excludedVotes} tone="danger" />
    </section>
    <StatisticsOverview rounds={recent.rounds} overviews={recent.overviews} />
  </main>;
}
