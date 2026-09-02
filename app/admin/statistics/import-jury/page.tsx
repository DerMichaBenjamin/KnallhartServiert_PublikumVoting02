import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { PageHeader } from '@/components/admin/AdminUi';
import HistoricalJuryImportPanel from '@/components/admin/HistoricalJuryImportPanel';

export const dynamic = 'force-dynamic';

export default async function HistoricalJuryImportPage() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');

  return <main>
    <PageHeader
      eyebrow={<a href="/admin/statistics">← Zurück zu Statistiken</a>}
      title="Historische Jurywertungen importieren"
      description="Sicherer, wiederholbarer Import aus der geprüften Excel-Rangliste. Vor dem Speichern werden Runden, Songs, Juroren und vorhandene Wertungen vollständig abgeglichen."
    />
    <div className="notice warning">
      <strong>Vor dem ersten Aufruf: DJ-Trennung in Supabase aktivieren.</strong>
      <span>Führe einmal <code>sql_dj_voting_separation.sql</code> im Supabase SQL Editor aus. Danach können Jury- und DJ-Spalten sicher getrennt importiert werden; vorhandene Wertungen werden nicht überschrieben.</span>
    </div>
    <HistoricalJuryImportPanel />
  </main>;
}
