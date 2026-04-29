import Link from 'next/link';
import { getImpressum } from '@/lib/impressum';

export default async function ImpressumPage() {
  const impressum = await getImpressum();
  return (
    <main className="min-h-screen px-4 py-8">
      <section className="mx-auto max-w-3xl admin-card p-5 md:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link href="/" className="btn btn-secondary">← Zurück</Link>
          <Link href="/admin/impressum" className="text-sm font-bold text-[#06285f] underline underline-offset-4">Impressum bearbeiten</Link>
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-[#06285f]">{impressum.title || 'Impressum'}</h1>
          {impressum.updated_at && <p className="mt-2 text-sm opacity-60">Zuletzt aktualisiert: {new Date(impressum.updated_at).toLocaleString('de-DE')}</p>}
        </div>
        <div className="prose-content whitespace-pre-wrap leading-relaxed text-[15px] md:text-base">
          {impressum.content}
        </div>
      </section>
    </main>
  );
}
