import Header from '@/components/Header';
import { buildLeaderboard, getSongs, getVerifiedVotes, listPublicResultRounds } from '@/lib/releaseVoting';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Ergebnisse() {
  const rounds = await listPublicResultRounds();
  const blocks = await Promise.all(
    rounds.map(async (round) => {
      const songs = await getSongs(round.id);
      const { votes, items } = await getVerifiedVotes(round.id);
      const board = buildLeaderboard(songs, votes, items).slice(0, 12);
      return { round, board };
    })
  );

  return (
    <main className="public-shell simple-page-shell">
      <Header />
      <section className="card simple-page-card">
        <h1>Ergebnisse bisheriger Abstimmungen</h1>
        {!blocks.length && <p>Noch keine öffentlichen Ergebnisse.</p>}
        {blocks.map(({ round, board }) => (
          <div className="result-block" key={round.id}>
            <h2>{round.title}</h2>
            <Link className="btn primary" href={`/release-voting/${round.slug}`}>Ergebnis öffnen</Link>
            <ol>
              {board.map((row) => (
                <li key={row.song.id}>
                  <b>{row.song.title}</b> – {row.song.artist} <span>{row.total} Punkte</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>
    </main>
  );
}
