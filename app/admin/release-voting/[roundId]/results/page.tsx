import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminRoundDetailData } from '@/lib/releaseVoting';
import { getAdminJuryRoundData } from '@/lib/juryVoting';
import { formatRoundPeriod } from '@/lib/adminUi';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import ResultsJuryCards from '@/components/admin/ResultsJuryCards';
import ResultsPublicTable from '@/components/admin/ResultsPublicTable';
import OverallResultsTable from '@/components/admin/OverallResultsTable';

export const dynamic = 'force-dynamic';

export default async function AdminResultsPage({ params }: { params: Promise<{ roundId: string }> }) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const { roundId } = await params; const [data, juryData] = await Promise.all([getAdminRoundDetailData(roundId), getAdminJuryRoundData(roundId)]); if (!data) notFound();
  const activeJurors = juryData.jurors.filter((juror) => juror.is_active);
  return <main><PageHeader eyebrow={<a href={`/admin/release-voting/${data.round.id}`}>← Zur Umfrage</a>} title={`Auswertung – ${data.round.title}`} description={formatRoundPeriod(data.round)} actions={<a className="ks-button secondary" href={`/admin/release-voting/${data.round.id}#top5`}>Top-5-Grafik anzeigen</a>} /><section className="ks-stats-grid results-head"><StatCard label="Songs" value={data.songs.length} /><StatCard label="Jury-Mitglieder" value={activeJurors.length} /><StatCard label="Publikumsstimmen" value={data.summary.totalVotes} /><StatCard label="Gewertet" value={data.summary.countedVotes} tone="success" /><StatCard label="Nicht bestätigt" value={data.summary.unverifiedVotes} tone="warning" /><StatCard label="In Prüfung" value={data.summary.reviewVotes} tone="warning" /><StatCard label="Ausgeschlossen" value={data.summary.excludedVotes} tone="danger" /></section><ResultsJuryCards songs={data.songs} summary={data.summary} juryData={juryData} /><ResultsPublicTable summary={data.summary} /><OverallResultsTable songs={data.songs} summary={data.summary} juryData={juryData} /></main>;
}
