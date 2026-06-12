import Link from 'next/link';
import Header from '@/components/Header';
import VotingRoundView from '@/components/VotingRoundView';
import { getCurrentDjRound } from '@/lib/releaseVoting';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function Page() {
  const round = await getCurrentDjRound();

  if (round) {
    return <VotingRoundView round={round} variant="dj" />;
  }

  return (
    <main className="public-shell">
      <Header />
      <h1>Kein aktuelles DJ-Voting ausgewählt</h1>
      <p>Bitte wähle im Adminbereich aus, welche Umfrage unter /dj-voting erscheinen soll.</p>
      <Link href="/release-voting">Zur Publikums-Abstimmung</Link>
    </main>
  );
}
