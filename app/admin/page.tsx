import AdminEditor from '@/components/AdminEditor';
import { todayISO } from '@/lib/config';
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const sp = await searchParams;
  return <AdminEditor initialDate={sp.date || todayISO()} />;
}
