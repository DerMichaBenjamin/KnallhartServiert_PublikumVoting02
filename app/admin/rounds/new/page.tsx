import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { PageHeader } from '@/components/admin/AdminUi';
import NewRoundForm from '@/components/admin/NewRoundForm';

export default async function NewRoundPage() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  return <main><PageHeader eyebrow={<a href="/admin/rounds">← Zur Übersicht</a>} title="Neue Umfrage" description="Release-Voting mit Songliste und den bestehenden Voting-Einstellungen anlegen." /><NewRoundForm /></main>;
}
