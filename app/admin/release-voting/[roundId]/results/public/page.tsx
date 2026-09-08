import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminRoundDetailData } from '@/lib/releaseVoting';
import { formatRoundPeriod } from '@/lib/adminUi';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import ResultsPublicTable from '@/components/admin/ResultsPublicTable';
import RoundViewNav from '@/components/admin/RoundViewNav';
import ResultsSubNav from '@/components/admin/ResultsSubNav';
import PrintCurrentPageButton from '@/components/admin/PrintCurrentPageButton';
import styles from '../results.module.css';

export const dynamic = 'force-dynamic';

export default async function PublicResultsPage({ params, searchParams }: { params: Promise<{ roundId: string }>; searchParams: Promise<{ print?: string }> }) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const [{ roundId }, query] = await Promise.all([params, searchParams]);
  const data = await getAdminRoundDetailData(roundId);
  if (!data) notFound();

  return <main className={styles.printLandscape}>
    <PageHeader
      eyebrow={<a href={`/admin/release-voting/${data.round.id}/results`}>← Ergebnisübersicht</a>}
      title={`Publikumsstimmen – ${data.round.title}`}
      description={formatRoundPeriod(data.round)}
      actions={<PrintCurrentPageButton autoPrint={query.print === '1'} label="Publikumsergebnis drucken" />}
    />
    <RoundViewNav roundId={data.round.id} active="results" />
    <ResultsSubNav roundId={data.round.id} active="public" />
    <section className="ks-stats-grid results-head">
      <StatCard label="Teilnehmer" value={data.summary.totalVotes} />
      <StatCard label="Gewertet" value={data.summary.countedVotes} tone="success" />
      <StatCard label="Nicht bestätigt" value={data.summary.unverifiedVotes} tone="warning" />
      <StatCard label="Ausgeschlossen" value={data.summary.excludedVotes} tone="danger" />
    </section>
    <ResultsPublicTable summary={data.summary} />
  </main>;
}
