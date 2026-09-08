import { notFound, redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminRoundDetailData } from '@/lib/releaseVoting';
import { getAdminJuryRoundData } from '@/lib/juryVoting';
import { formatRoundPeriod } from '@/lib/adminUi';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import RoundViewNav from '@/components/admin/RoundViewNav';
import ResultsSubNav from '@/components/admin/ResultsSubNav';
import styles from './results.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminResultsHubPage({ params, searchParams }: { params: Promise<{ roundId: string }>; searchParams: Promise<{ print?: string }> }) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const [{ roundId }, query] = await Promise.all([params, searchParams]);
  if (query.print === '1') redirect(`/admin/release-voting/${roundId}/results/overall?print=1`);
  const [data, juryData] = await Promise.all([getAdminRoundDetailData(roundId), getAdminJuryRoundData(roundId)]);
  if (!data) notFound();

  const activeJurors = juryData.jurors.filter((juror) => juror.is_active);
  const submittedJurors = activeJurors.filter((juror) => Boolean(juror.submitted_at));

  return <main>
    <PageHeader
      eyebrow={<a href={`/admin/release-voting/${data.round.id}`}>← Zur Umfrage</a>}
      title={`Ergebnisse – ${data.round.title}`}
      description={`${formatRoundPeriod(data.round)} · Wähle eine Auswertung aus.`}
      actions={<a className="ks-button secondary no-print" href={`/admin/release-voting/${data.round.id}#top5`}>Top-5-/Top-12-Grafik</a>}
    />
    <RoundViewNav roundId={data.round.id} active="results" />
    <ResultsSubNav roundId={data.round.id} active="hub" />

    <section className="ks-stats-grid results-head">
      <StatCard label="Songs" value={data.songs.length} />
      <StatCard label="Jury abgegeben" value={`${submittedJurors.length}/${activeJurors.length}`} tone="success" />
      <StatCard label="Publikumsstimmen" value={data.summary.totalVotes} />
      <StatCard label="Publikum gewertet" value={data.summary.countedVotes} tone="success" />
    </section>

    <section className={`ks-quick-grid ${styles.hubGrid}`}>
      <a className="ks-quick-action" href={`/admin/release-voting/${data.round.id}/results/jury`}><strong>Juryergebnisse</strong><span>Einzelwertungen aller Jurymitglieder, Publikum als Vergleich, Ø Jury und Jury-ZONK.</span><b>→</b></a>
      <a className="ks-quick-action" href={`/admin/release-voting/${data.round.id}/results/public`}><strong>Publikumsstimmen</strong><span>Publikumsranking, Ø Publikum, Anzahl der Nennungen und Publikums-ZONK.</span><b>→</b></a>
      <a className="ks-quick-action accent" href={`/admin/release-voting/${data.round.id}/results/overall`}><strong>Gesamtwertung</strong><span>Jury + Publikum mit Einzelpunkten der Juroren, Ø Jury, Ø Gesamt und Gesamt-ZONK.</span><b>→</b></a>
    </section>
  </main>;
}
