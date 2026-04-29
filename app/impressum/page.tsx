import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { formatDateTime, getImprintSettings } from '@/lib/releaseVoting';

export const dynamic = 'force-dynamic';

export default async function ImprintPage() {
  const { data: imprint } = await getImprintSettings();

  return (
    <main className="public-shell imprint-shell">
      <section className="table-card elevated-card imprint-card">
        <div className="imprint-head">
          <BrandLogo compact />
          <div>
            <div className="pill">Rechtliches</div>
            <h1 className="hero-title imprint-title">Impressum</h1>
            {imprint.updated_at && (
              <p className="section-subtitle">Zuletzt aktualisiert: {formatDateTime(imprint.updated_at)}</p>
            )}
          </div>
        </div>

        <div className="imprint-content">{imprint.content}</div>

        <div className="imprint-actions">
          <Link href="/release-voting" className="button secondary small">Zur Abstimmung</Link>
        </div>
      </section>
    </main>
  );
}
