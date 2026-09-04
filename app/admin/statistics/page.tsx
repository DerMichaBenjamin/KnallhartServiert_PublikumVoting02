import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminOverviewTotals, getAdminRoundsPage } from '@/lib/adminOverview';
import { PageHeader, StatCard } from '@/components/admin/AdminUi';
import StatisticsOverview from '@/components/admin/StatisticsOverview';
import { describeDatabaseError } from '@/lib/supabaseErrors';

export const dynamic = 'force-dynamic';

export default async function AdminStatisticsPage() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const [totalsResult, recentResult] = await Promise.allSettled([
    // Leere Rundenliste überspringt hier bewusst den teuren Aktivitäts-Fan-out.
    // Die exakte Zahl durchgeführter Wochen entsteht unten beim Batch-Nachladen.
    getAdminOverviewTotals([], { statisticsOnly: true }),
    getAdminRoundsPage({ page: 1, pageSize: 8, statisticsOnly: true }),
  ]);
  const totals = totalsResult.status === 'fulfilled' ? totalsResult.value : null;
  const recent = recentResult.status === 'fulfilled' ? recentResult.value : { rounds: [], overviews: [] };
  const loadWarnings = [
    totalsResult.status === 'rejected' ? `Globale Kennzahlen: ${describeDatabaseError(totalsResult.reason)}` : null,
    recentResult.status === 'rejected' ? `Letzte Umfragen: ${describeDatabaseError(recentResult.reason)}` : null,
  ].filter((warning): warning is string => Boolean(warning));
  const needsDjMigration = loadWarnings.some((warning) => /voting_channel|voting_role|schema cache|PGRST20[034]/i.test(warning));

  return <main>
    <PageHeader title="Statistiken" description="Aktuelle Woche, historische Vergleiche und Künstlerhistorie auf Basis der vorhandenen Votingdaten." actions={<span className="ks-inline-actions"><a className="ks-button secondary" href="/admin/statistics/import-jury">Historische Jurywerte importieren</a><a className="ks-button primary" href="#historical-exports">CSV-/XLSX-Gesamtexporte</a></span>} />
    {loadWarnings.length > 0 && <div className="notice error"><strong>Ein Teil der Statistikdaten ist derzeit nicht erreichbar.</strong><ul>{loadWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>{needsDjMigration && <span><strong>Die DJ-Trennung ist in der von Vercel verwendeten Supabase-Datenbank noch nicht sichtbar.</strong> Bitte die mitgelieferte SQL-Datei dort vollständig ausführen und anschließend kontrollieren, ob die Ergebnisabfrage Zeilen für <code>voting_channel</code> und <code>voting_role</code> ausgibt.</span>}<span>Die historischen Detaildaten werden unabhängig davon weiter unten gestaffelt geladen.</span></div>}
    {totals && <section className="ks-stats-grid dashboard">
      <StatCard label="Umfragen für Statistiken" value={totals.databaseRounds} hint="Test- und separate DJ-Runden sind ausgeblendet" tone="violet" />
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
