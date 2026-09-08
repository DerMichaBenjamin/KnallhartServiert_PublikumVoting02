import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminRoundDetailData } from '@/lib/releaseVoting';
import { getAdminJuryRoundData } from '@/lib/juryVoting';
import { formatRoundPeriod } from '@/lib/adminUi';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import DetailedOverallResultsTable from '@/components/admin/DetailedOverallResultsTable';
import RoundViewNav from '@/components/admin/RoundViewNav';
import ResultsSubNav from '@/components/admin/ResultsSubNav';
import PrintCurrentPageButton from '@/components/admin/PrintCurrentPageButton';
import styles from '../results.module.css';

export const dynamic = 'force-dynamic';

export default async function OverallResultsPage({ params, searchParams }: { params: Promise<{ roundId: string }>; searchParams: Promise<{ print?: string }> }) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const [{ roundId }, query] = await Promise.all([params, searchParams]);
  const [data, juryData] = await Promise.all([getAdminRoundDetailData(roundId), getAdminJuryRoundData(roundId)]);
  if (!data) notFound();
  const activeJurors = juryData.jurors.filter((juror) => juror.is_active);
  const submittedJurors = activeJurors.filter((juror) => Boolean(juror.submitted_at));

  return <main className={styles.printLandscape}>
    <PageHeader
      eyebrow={<a href={`/admin/release-voting/${data.round.id}/results`}>← Ergebnisübersicht</a>}
      title={`Gesamtwertung – ${data.round.title}`}
      description={formatRoundPeriod(data.round)}
      actions={<PrintCurrentPageButton autoPrint={query.print === '1'} label="Gesamtwertung drucken" />}
    />
    <RoundViewNav roundId={data.round.id} active="results" />
    <ResultsSubNav roundId={data.round.id} active="overall" />
    <section className="ks-stats-grid results-head">
      <StatCard label="Songs" value={data.songs.length} />
      <StatCard label="Jury abgegeben" value={`${submittedJurors.length}/${activeJurors.length}`} tone="success" />
      <StatCard label="Publikum gewertet" value={data.summary.countedVotes} />
      <StatCard label="Wertungsquellen" value={submittedJurors.length + (data.summary.countedVotes > 0 ? 1 : 0)} />
    </section>
    <DetailedOverallResultsTable songs={data.songs} summary={data.summary} juryData={juryData} />
  </main>;
}
