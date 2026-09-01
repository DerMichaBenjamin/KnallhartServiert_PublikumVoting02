import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { listRounds } from '@/lib/releaseVoting';
import { getAdminRoundOverviews } from '@/lib/adminOverview';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import StatisticsOverview from '@/components/admin/StatisticsOverview';

export const dynamic = 'force-dynamic';

export default async function AdminStatisticsPage() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const rounds = await listRounds(); const overviews = await getAdminRoundOverviews(rounds);
  const totals = overviews.reduce((sum, item) => ({ songs: sum.songs + item.songsCount, total: sum.total + item.totalVotes, counted: sum.counted + item.countedVotes, unverified: sum.unverified + item.unverifiedVotes, review: sum.review + item.reviewVotes, excluded: sum.excluded + item.excludedVotes }), { songs: 0, total: 0, counted: 0, unverified: 0, review: 0, excluded: 0 });
  return <main><PageHeader title="Statistiken" description="Tatsächliche Kennzahlen aus allen vorhandenen Umfragen." /><section className="ks-stats-grid dashboard"><StatCard label="Umfragen" value={rounds.length} tone="violet" /><StatCard label="Songs insgesamt" value={totals.songs} /><StatCard label="Stimmen insgesamt" value={totals.total} /><StatCard label="Gewertet" value={totals.counted} tone="success" /><StatCard label="Nicht bestätigt" value={totals.unverified} tone="warning" /><StatCard label="In Prüfung" value={totals.review} tone="warning" /><StatCard label="Ausgeschlossen" value={totals.excluded} tone="danger" /></section><StatisticsOverview rounds={rounds} overviews={overviews} /></main>;
}
