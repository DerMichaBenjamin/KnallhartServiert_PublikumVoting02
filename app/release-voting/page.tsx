import { redirect } from 'next/navigation';
import { getCurrentRound } from '@/lib/releaseVoting';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const round = await getCurrentRound();

  if (round) {
    redirect(`/release-voting/${round.slug}`);
  }

  return (
    <main className="public-shell">
      <h1>Keine öffentliche Haupt-Abstimmung ausgewählt</h1>
      <p>Bitte wähle im Adminbereich aus, welche Umfrage unter /release-voting erscheinen soll.</p>
      <a href="/ergebnisse">Zu den Ergebnissen</a>
    </main>
  );
}
