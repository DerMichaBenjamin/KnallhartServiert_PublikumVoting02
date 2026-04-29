import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentRound } from '@/lib/releaseVoting';

export const dynamic = 'force-dynamic';

export default async function ReleaseVotingPage() {
  const { data: round } = await getCurrentRound();
  if (round?.slug) redirect(`/release-voting/${round.slug}`);

  return (
    <main className="public-shell">
      <section className="table-card elevated-card">
        <h1 className="hero-title">Keine aktive Abstimmung</h1>
        <p className="hero-copy">Aktuell ist keine Voting-Runde freigeschaltet.</p>
      </section>
      <footer className="public-legal-footer"><Link href="/impressum">Impressum</Link></footer>
    </main>
  );
}
