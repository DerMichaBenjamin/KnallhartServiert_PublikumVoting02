import Header from '@/components/Header';
import Link from 'next/link';
import { DEFAULT_IMPRESSUM, getSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function Impressum() {
  const text = await getSetting('impressum_text', DEFAULT_IMPRESSUM);

  return (
    <main className="public-shell">
      <Header />
      <section className="card">
        <h1>Impressum</h1>
        <div className="impressum-text">{text}</div>
      </section>
      <footer className="legal-footer"><Link href="/datenschutz">Datenschutz</Link><Link href="/impressum">Impressum</Link></footer>
    </main>
  );
}
