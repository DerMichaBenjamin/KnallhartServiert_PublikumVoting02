import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import SnippetEditor from '@/components/admin/SnippetEditor';

export default async function SnippetsPage() {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  return <SnippetEditor />;
}
