import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { DEFAULT_IMPRESSUM, getSetting } from '@/lib/settings';
import { PageHeader } from '@/components/admin/AdminUi';
import ImpressumEditor from '@/components/admin/ImpressumEditor';

export const dynamic = 'force-dynamic';

export default async function AdminImpressumPage() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const impressum = await getSetting('impressum_text', DEFAULT_IMPRESSUM);
  return <main><PageHeader title="Impressum" description="Text der öffentlichen Impressumsseite bearbeiten." /><ImpressumEditor initialValue={impressum} /></main>;
}
