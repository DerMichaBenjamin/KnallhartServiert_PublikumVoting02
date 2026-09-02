import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminRoundDetailData } from '@/lib/releaseVoting';
import { getAdminJuryRoundData } from '@/lib/juryVoting';
import { buildReleaseWeekStatistics, buildReportGraphicData, formatReportPeriod } from '@/lib/releaseStatisticsCore';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import OverallResultsTable from '@/components/admin/OverallResultsTable';
import ReportActions from '@/components/admin/ReportActions';
import RoundViewNav from '@/components/admin/RoundViewNav';
import WeeklyStatistics from '@/components/admin/WeeklyStatistics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminRoundReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ roundId: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const [{ roundId }, query] = await Promise.all([params, searchParams]);
  const [detail, juryData] = await Promise.all([
    getAdminRoundDetailData(roundId, { includeParticipants: false }),
    getAdminJuryRoundData(roundId),
  ]);
  if (!detail) notFound();
  const stats = buildReleaseWeekStatistics(detail.round, detail.songs, detail.summary, juryData);
  const graphicData = buildReportGraphicData(stats);
  const winner = stats.overallRows.find((row) => row.rank === 1);

  return <main className="ks-print-report ks-combined-report">
    <PageHeader
      eyebrow={<a href="/admin/statistics">← Alle Statistiken</a>}
      title={`Gesamtauswertung – ${detail.round.title}`}
      description={formatReportPeriod(detail.round)}
    />
    <RoundViewNav roundId={roundId} active="report" />
    <ReportActions data={graphicData} view="combined" autoPrint={query.print === '1'} />
    <section className="ks-stats-grid results-head ks-report-summary">
      <StatCard label="Sieger" value={winner?.song.title || '—'} hint={winner?.song.artist} tone="violet" />
      <StatCard label="Songs" value={stats.songsCount} />
      <StatCard label="Publikums-Votings" value={stats.totalVotes} />
      <StatCard label="Gewertet" value={stats.countedVotes} tone="success" />
      <StatCard label="Jury abgegeben" value={`${stats.submittedJurors}/${stats.activeJurors}`} />
      <StatCard label="Abstand Platz 1–2" value={stats.winnerGap ?? '—'} />
      <StatCard label="Ø Polarisation" value={stats.averagePolarization === null ? '—' : stats.averagePolarization.toLocaleString('de-DE', { maximumFractionDigits: 1 })} />
    </section>
    <OverallResultsTable songs={detail.songs} summary={detail.summary} juryData={juryData} />
    <WeeklyStatistics stats={stats} />
  </main>;
}
