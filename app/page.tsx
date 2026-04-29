import Link from 'next/link';
import StoryCanvas from '@/components/StoryCanvas';
import ExportButton from '@/components/ExportButton';
import PWAInstallButton from '@/components/PWAInstallButton';
import { todayISO, EventItem, sortEventsForShow, shiftDate, formatGermanDate } from '@/lib/config';
import { supabaseAdmin } from '@/lib/supabase';

async function getEvents(date: string): Promise<EventItem[]> {
  try {
    const { data, error } = await supabaseAdmin().from('events').select('*').eq('date', date).order('location').order('time');
    if (error) throw error;
    return sortEventsForShow((data || []) as EventItem[]);
  } catch { return []; }
}

export default async function Home({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const sp = searchParams ? await searchParams : {};
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || '') ? String(sp.date) : todayISO();
  const events = await getEvents(selectedDate);
  const prev = shiftDate(selectedDate, -1);
  const next = shiftDate(selectedDate, 1);

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7d7_0,#f3f7fb_42%,#eaf2ff_100%)] px-4 py-5 md:py-8">
    <section className="mx-auto max-w-7xl grid xl:grid-cols-[minmax(360px,520px)_1fr] gap-6 items-start">
      <aside className="admin-card p-5 md:p-6 space-y-5 xl:sticky xl:top-6 order-2 xl:order-1">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ef146d]">Knallhart serviert</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-black leading-tight text-[#06285f]">Live-Auftritte Mallorca</h1>
          <p className="mt-3 text-sm md:text-base font-semibold text-slate-600">Tagesübersicht als Story-Grafik. Die Startseite wechselt erst ab 02:00 Uhr auf den neuen Tag.</p>
        </div>

        <div className="rounded-2xl border border-[#dbe5f1] bg-white/75 p-4 space-y-3">
          <p className="text-sm font-black text-slate-500">Angezeigter Tag</p>
          <p className="text-2xl font-black text-[#06285f] leading-tight">{formatGermanDate(selectedDate)}</p>
          <div className="grid grid-cols-2 gap-2">
            <Link className="btn btn-secondary text-center" href={`/?date=${prev}`}>← Vorheriger Tag</Link>
            <Link className="btn btn-secondary text-center" href={`/?date=${next}`}>Nächster Tag →</Link>
            <Link className="btn btn-secondary text-center col-span-2" href="/">Heute automatisch</Link>
          </div>
        </div>

        <div className="grid gap-3">
          <ExportButton date={selectedDate} targetId="story-canvas-export" />
          <PWAInstallButton />
          <Link href="/admin" className="btn btn-secondary text-center">Admin öffnen</Link>
        </div>

        <div className="text-xs font-semibold text-slate-500 leading-relaxed">
          <p>PNG-Export: exakt 1080 × 1920 px. Buttons und Links werden nicht mit exportiert.</p>
          <a href="/impressum" className="inline-block mt-3 font-black underline underline-offset-4">Impressum</a>
        </div>
      </aside>

      <section className="order-1 xl:order-2 flex justify-center">
        <div className="w-full max-w-[430px] sm:max-w-[500px] md:max-w-[560px] lg:max-w-[620px] rounded-[28px] bg-white/65 p-3 md:p-4 shadow-2xl shadow-[#06285f]/15 border border-white">
          <div className="overflow-hidden rounded-[22px] bg-white">
            <StoryCanvas date={selectedDate} events={events} scale={0.38} exportId="story-canvas-preview" />
          </div>
        </div>
      </section>
    </section>

    <div aria-hidden="true" className="fixed left-[-99999px] top-0 w-[1080px] h-[1920px] overflow-hidden">
      <StoryCanvas date={selectedDate} events={events} scale={1} exportId="story-canvas-export" />
    </div>
  </main>;
}
