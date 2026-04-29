import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { formatGermanDate } from '@/lib/config';

export default async function ArchivPage() {
  let dates: string[] = [];
  try {
    const { data } = await supabaseAdmin().from('events').select('date').order('date', { ascending: false });
    dates = Array.from(new Set((data || []).map(x => x.date)));
  } catch {}
  return <main className="min-h-screen p-6 max-w-3xl mx-auto space-y-5">
    <div className="admin-card p-5"><Link className="btn btn-secondary" href="/admin">← Admin</Link><h1 className="text-3xl font-black mt-4">Vergangene Termine / Archiv</h1></div>
    <div className="admin-card p-5 space-y-2">
      {dates.length === 0 && <p>Noch keine Termine gespeichert.</p>}
      {dates.map(d => <Link key={d} className="block p-4 rounded-xl border hover:bg-blue-50 font-black" href={`/admin?date=${d}`}>{formatGermanDate(d)} <span className="opacity-60">({d})</span></Link>)}
    </div>
  </main>;
}
