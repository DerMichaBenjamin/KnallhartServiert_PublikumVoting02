import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminOverviewTotals, getAdminRoundsPage } from '@/lib/adminOverview';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import StatisticsOverview from '@/components/admin/StatisticsOverview';

export const dynamic = 'force-dynamic';

export default async function AdminStatisticsPage() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const [totalsResult, recentResult] = await Promise.allSettled([
    // Leere Rundenliste überspringt hier bewusst den teuren Aktivitäts-Fan-out.
    // Die exakte Zahl durchgeführter Wochen entsteht unten beim Batch-Nachladen.
    getAdminOverviewTotals([]),
    getAdminRoundsPage({ page: 1, pageSize: 8 }),
  ]);
  const totals = totalsResult.status === 'fulfilled' ? totalsResult.value : null;
  const recent = recentResult.status === 'fulfilled' ? recentResult.value : { rounds: [], overviews: [] };
  const loadWarnings = [
    totalsResult.status === 'rejected' ? 'Die globalen Kennzahlen konnten nicht geladen werden.' : null,
    recentResult.status === 'rejected' ? 'Die zuletzt durchgeführten Umfragen konnten nicht geladen werden.' : null,
  ].filter((warning): warning is string => Boolean(warning));

  return <main>
    <PageHeader title="Statistiken" description="Aktuelle Woche, historische Vergleiche und Künstlerhistorie auf Basis der vorhandenen Votingdaten." actions={<a className="ks-button primary" href="#historical-exports">CSV-/XLSX-Gesamtexporte</a>} />
    {loadWarnings.length > 0 && <div className="notice error"><strong>Ein Teil der Statistikdaten ist derzeit nicht erreichbar.</strong><ul>{loadWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><span>Die historischen Detaildaten werden unabhängig davon weiter unten gestaffelt geladen.</span></div>}
    {totals && <section className="ks-stats-grid dashboard">
      <StatCard label="Umfragen/Datenbankeinträge" value={totals.databaseRounds} hint="Durchgeführte Wochen werden unten ermittelt" tone="violet" />
      <StatCard label="Songs insgesamt" value={totals.songsCount} />
      <StatCard label="Stimmen insgesamt" value={totals.totalVotes} />
      <StatCard label="Gewertet" value={totals.countedVotes} tone="success" />
      <StatCard label="Nicht bestätigt" value={totals.unverifiedVotes} tone="warning" />
      <StatCard label="In Prüfung" value={totals.reviewVotes} tone="warning" />
      <StatCard label="Ausgeschlossen" value={totals.excludedVotes} tone="danger" />
    </section>}
    <StatisticsOverview rounds={recent.rounds} overviews={recent.overviews} />
  </main>;
}
