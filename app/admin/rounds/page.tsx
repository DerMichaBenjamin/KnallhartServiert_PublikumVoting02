import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { listRounds } from '@/lib/releaseVoting';
import { getAdminRoundOverviews } from '@/lib/adminOverview';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import RoundsTable from '@/components/admin/RoundsTable';

export const dynamic = 'force-dynamic';

export default async function AdminRoundsPage() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const rounds = await listRounds(); const overviews = await getAdminRoundOverviews(rounds);
  const totalSongs = overviews.reduce((sum, item) => sum + item.songsCount, 0); const totalVotes = overviews.reduce((sum, item) => sum + item.totalVotes, 0);
  return <main><PageHeader title="Umfragen" description="Alle Release-Votings im Überblick." actions={<a className="ks-button primary" href="/admin/rounds/new">+ Neue Umfrage</a>} /><section className="ks-stats-grid overview"><StatCard label="Umfragen insgesamt" value={rounds.length} tone="violet" /><StatCard label="Songs insgesamt" value={totalSongs} /><StatCard label="Publikumsstimmen insgesamt" value={totalVotes} /></section><RoundsTable rounds={rounds} overviews={overviews} /></main>;
}
