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
      <strong>Es werden keine vorhandenen Wertungen überschrieben.</strong>
      <span>Der erste Aufruf ist immer nur ein Dry-Run. Fehlerhafte Excel-Spalten und nicht eindeutige Songzuordnungen bleiben unangetastet.</span>
    </div>
    <HistoricalJuryImportPanel />
  </main>;
}
