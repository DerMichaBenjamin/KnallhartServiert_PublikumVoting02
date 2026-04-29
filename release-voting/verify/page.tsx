import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { verifyVoteToken } from '@/lib/emailVerification';

export const dynamic = 'force-dynamic';

export default async function VerifyVotePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params?.token === 'string' ? params.token : '';

  let isSuccess = false;
  let message = 'Der Bestätigungslink ist ungültig oder wurde nicht gefunden.';

  if (!token) {
    message = 'Der Bestätigungslink ist unvollständig.';
  } else {
    const result = await verifyVoteToken(token);
    isSuccess = result.ok;
    message = result.message || message;
  }

  return (
    <main className="public-shell vote-public-shell">
      <section className="table-card public-card-soft verify-card-center vote-verify-card">
        <div className="vote-verify-header">
          <BrandLogo compact />
          <div className="vote-verify-header-copy">
            <div className="pill">Knallhart serviert Publikums-Voting</div>
            <h1 className="hero-title vote-verify-title">{isSuccess ? 'Voting bestätigt' : 'Bestätigung fehlgeschlagen'}</h1>
            <p className="hero-copy vote-verify-copy">{message}</p>
            <div className="vote-verify-actions">
              <Link className="button primary" href="/release-voting">Zur Voting-Seite</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
