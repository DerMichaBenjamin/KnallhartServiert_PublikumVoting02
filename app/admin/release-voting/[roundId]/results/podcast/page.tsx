import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminRoundDetailData } from '@/lib/releaseVoting';
import { getAdminJuryRoundData } from '@/lib/juryVoting';
import { formatRoundPeriod } from '@/lib/adminUi';
import { buildPodcastReportData } from '@/lib/podcastReport';
import { PageHeader } from '@/components/admin/AdminUi';
import RoundViewNav from '@/components/admin/RoundViewNav';
import ResultsSubNav from '@/components/admin/ResultsSubNav';
import PodcastReport from '@/components/admin/PodcastReport';
import PodcastReportActions from '@/components/admin/PodcastReportActions';
import styles from '../results.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function PodcastResultsPage({ params, searchParams }: { params: Promise<{ roundId: string }>; searchParams: Promise<{ print?: string }> }) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const [{ roundId }, query] = await Promise.all([params, searchParams]);
  const [detail, juryData] = await Promise.all([
    getAdminRoundDetailData(roundId, { includeParticipants: false }),
    getAdminJuryRoundData(roundId),
  ]);
  if (!detail) notFound();

  const report = buildPodcastReportData(detail.round, detail.songs, detail.summary, juryData);

  return <main className={`${styles.podcastPrintPage} ${styles.printLandscape}`}>
    <PageHeader
      eyebrow={<a href={`/admin/release-voting/${detail.round.id}/results`}>← Ergebnisübersicht</a>}
      title={`Sendungsausdruck – ${detail.round.title}`}
      description={`${formatRoundPeriod(detail.round)} · Alles Wichtige für die Podcast-Aufzeichnung auf genau zwei DIN-A4-Seiten.`}
      actions={<PodcastReportActions data={report} autoPrint={query.print === '1'} />}
    />
    <RoundViewNav roundId={detail.round.id} active="results" />
    <ResultsSubNav roundId={detail.round.id} active="podcast" />
    <PodcastReport data={report} />
  </main>;
}
