import Header from '@/components/Header';
import VotingRoundView from '@/components/VotingRoundView';
import { getRoundBySlug } from '@/lib/releaseVoting';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const round = await getRoundBySlug(slug);

  if (!round) {
    return (
      <main className="public-shell">
        <Header />
        <h1>DJ-Voting nicht gefunden</h1>
      </main>
    );
  }

  return <VotingRoundView round={round} variant="dj" />;
}
