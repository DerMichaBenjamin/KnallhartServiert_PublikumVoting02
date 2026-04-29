'use client';
import Image from 'next/image';
import { EventItem, LOCATIONS, LOCATION_META, formatGermanDate, sortEventsForShow } from '@/lib/config';

export default function StoryCanvas({ date, events, scale = 1, exportId = 'story-canvas' }: { date: string; events: EventItem[]; scale?: number; exportId?: string }) {
  const byLocation = Object.fromEntries(LOCATIONS.map(l => [l, sortEventsForShow(events.filter(e => e.location === l))])) as Record<string, EventItem[]>;
  return (
    <div style={{ width: 1080 * scale, height: 1920 * scale, overflow: 'hidden' }}>
      <div id={exportId} className="story-bg relative text-[#06285f]" style={{ width: 1080, height: 1920, transform: scale === 1 ? "none" : `scale(${scale})`, transformOrigin: 'top left' }}>
        <div className="relative z-10 h-full px-[70px] pt-[38px] pb-[38px] flex flex-col">
          <header className="text-center">
            <div className="mx-auto relative w-[390px] h-[230px] -mb-[4px]"><Image src="/knallhart-logo.png" alt="Knallhart serviert" fill className="object-contain" priority /></div>
            <div className="text-[64px] font-black tracking-[5px] leading-none">LIVE-AUFTRITTE</div>
            <div className="text-[38px] font-black tracking-[14px] text-[#ef146d] mt-[10px]">MALLORCA</div>
            <div className="mx-auto mt-[18px] h-[8px] w-[620px] bg-[#ef146d] rounded-full opacity-90" />
            <h1 className="mt-[22px] text-[78px] leading-[1.02] font-black tracking-[-2px]">{formatGermanDate(date)}</h1>
          </header>
          <main className="grid grid-cols-2 gap-[28px] mt-[38px] flex-1">
            {LOCATIONS.map(location => {
              const meta = LOCATION_META[location];
              const list = byLocation[location] || [];
              return (
                <section key={location} className="card-glass rounded-[34px] border-[4px] p-[24px] flex flex-col" style={{ borderColor: meta.color }}>
                  <div className="relative h-[150px] mb-[6px]"><Image src={meta.logo} alt={location} fill className="object-contain" /></div>
                  <h2 className="text-center text-[45px] font-black leading-none" style={{ color: meta.color }}>{meta.short}</h2>
                  <div className="mx-auto my-[14px] h-[4px] w-[260px] rounded-full" style={{ backgroundColor: meta.color }} />
                  <div className="flex-1 flex flex-col justify-center gap-[9px]">
                    {list.length === 0 && <p className="text-center text-[30px] font-bold opacity-60">Noch keine Termine</p>}
                    {list.slice(0, 10).map((ev, i) => (
                      <div key={`${ev.time}-${ev.title}-${i}`} className="grid grid-cols-[110px_1fr] gap-[18px] border-b border-black/10 pb-[5px] items-baseline">
                        <span className="text-[32px] font-black text-black">{ev.time}</span>
                        <span className="text-[31px] font-bold text-black leading-tight truncate">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                  {list.length > 8 && <p className="mt-[8px] text-center text-[21px] font-black text-[#d61f43]">Viele Termine – bitte Vorschau prüfen.</p>}
                </section>
              );
            })}
          </main>
          <footer className="text-center mt-[28px] text-[34px] font-black tracking-[5px] text-white drop-shadow-[0_2px_7px_rgba(0,0,0,.45)]">KNALLHART. LAUT. <span className="text-[#ef146d]">LIVE.</span></footer>
        </div>
      </div>
    </div>
  );
}
