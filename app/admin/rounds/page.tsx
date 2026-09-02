import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminOverviewTotals, getAdminRoundsPage, type AdminRoundsFilter } from '@/lib/adminOverview';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import RoundsTable from '@/components/admin/RoundsTable';

export const dynamic = 'force-dynamic';

function readFilter(value?: string): AdminRoundsFilter {
  return value === 'active' || value === 'planned' || value === 'ended' ? value : 'all';
}

export default async function AdminRoundsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const params = await searchParams;
  const query = String(params.q || '').trim();
  const filter = readFilter(params.status);
  const page = Math.max(1, Number.parseInt(String(params.page || '1'), 10) || 1);
  const [totals, pageData] = await Promise.all([
    getAdminOverviewTotals(),
    getAdminRoundsPage({ page, pageSize: 8, query, filter }),
  ]);

  return <main>
    <PageHeader title="Umfragen" description="Alle Release-Votings im Überblick." actions={<a className="ks-button primary" href="/admin/rounds/new">+ Neue Umfrage</a>} />
    <section className="ks-stats-grid overview">
      <StatCard label="Datenbankeinträge insgesamt" value={totals.databaseRounds} hint={`${totals.conductedRounds} mit Votingaktivität`} tone="violet" />
      <StatCard label="Songs insgesamt" value={totals.songsCount} />
      <StatCard label="Publikumsstimmen insgesamt" value={totals.totalVotes} />
    </section>
    <RoundsTable {...pageData} query={query} filter={filter} />
  </main>;
}
