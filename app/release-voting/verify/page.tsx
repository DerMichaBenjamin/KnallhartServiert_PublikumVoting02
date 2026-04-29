import Link from 'next/link';
import Header from '@/components/Header';
import { verifyVoteToken } from '@/lib/emailVerification';

export const dynamic = 'force-dynamic';

type VerifySearchParams = Promise<{ token?: string }>;

export default async function Verify({ searchParams }: { searchParams: VerifySearchParams }) {
  const params = await searchParams;
  const token = params.token || '';
  const result = token
    ? await verifyVoteToken(token)
    : { ok: false as const, message: 'Der Bestätigungslink ist unvollständig.' };

  return (
    <main className="public-shell">
      <Header />
      <section className="card verify">
        <img src="/khs-logo.png" alt="Knallhart serviert" />
        <div>
          <p className="pill">Knallhart serviert Publikums-Voting</p>
          <h1>{result.ok ? 'Voting bestätigt' : 'Bestätigung fehlgeschlagen'}</h1>
          <p>{result.message}</p>
          {!result.ok && (
            <p className="muted">
              Falls du den Link aus einer älteren Mail geöffnet hast, stimme bitte noch einmal neu ab. Alte Links können nach Deploys oder abgelaufener Frist ungültig sein.
            </p>
          )}
          <Link className="btn primary" href="/release-voting">
            Zur Voting-Seite
          </Link>
        </div>
      </section>
    </main>
  );
}
