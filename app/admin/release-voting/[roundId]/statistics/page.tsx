import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getReleaseStatisticsArchive } from '@/lib/releaseStatistics';
import { buildReportGraphicData, buildWeekComparison, formatReportPeriod } from '@/lib/releaseStatisticsCore';
import { PageHeader } from '@/components/admin/AdminUi';
import ReportActions from '@/components/admin/ReportActions';
import WeeklyStatistics from '@/components/admin/WeeklyStatistics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminRoundStatisticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ roundId: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const [{ roundId }, query] = await Promise.all([params, searchParams]);
  const archive = await getReleaseStatisticsArchive();
  const stats = archive.weeks.find((week) => week.round.id === roundId);
  if (!stats) notFound();
  const comparison = buildWeekComparison(stats, archive.weeks);
  const graphicData = buildReportGraphicData(stats);

  return <main className="ks-print-report ks-statistics-report">
    <PageHeader
      eyebrow={<a href={`/admin/release-voting/${roundId}/results`}>← Zur Auswertung</a>}
      title={`Statistiken – ${stats.round.title}`}
      description={formatReportPeriod(stats.round)}
      actions={<a className="ks-button secondary no-print" href={`/admin/release-voting/${roundId}`}>Umfrage verwalten</a>}
    />
    <ReportActions data={graphicData} view="statistics" autoPrint={query.print === '1'} />
    <WeeklyStatistics stats={stats} comparison={comparison} />
  </main>;
}
