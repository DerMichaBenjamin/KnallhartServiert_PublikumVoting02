import Header from '@/components/Header';
import SpotifySidebar from '@/components/SpotifySidebar';
import PublicVotingForm from '@/components/PublicVotingForm';
import { buildLeaderboard, buildZonk, getRoundBySlug, getSongs, getVerifiedVotes } from '@/lib/releaseVoting';
import { formatDateTimeDE } from '@/lib/dateTime';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const round = await getRoundBySlug(slug);

  if (!round) {
    return (
      <main className="public-shell">
        <Header />
        <h1>Abstimmung nicht gefunden</h1>
      </main>
    );
  }

  const songs = await getSongs(round.id);
  const now = Date.now();
  const isLive =
    round.status === 'live' &&
    (!round.starts_at || Date.parse(round.starts_at) <= now) &&
    (!round.ends_at || Date.parse(round.ends_at) >= now);

  const { votes, items } = await getVerifiedVotes(round.id);
  const board = buildLeaderboard(songs, votes, items);
  const zonk = buildZonk(songs, votes).filter((entry) => entry.count > 0);

  return (
    <main className="voting-page">
      <SpotifySidebar playlistId={round.spotify_playlist_id} />
      <section className="voting-main">
        <Header />
        <h1>
          Knallhart serviert<br />
          <span>Publikums-Voting</span>
        </h1>
        <p>Wähle deine 12 Favoriten und bestätige deine Stimme per E-Mail.</p>

        <div className="status-grid">
          <div className="status-card">
            <small>Dein Voting-Status</small>
            <b>{isLive ? 'Noch keine Auswahl' : 'Beendet'}</b>
          </div>
          <div className="status-card">
            <small>Abstimmungszeitraum</small>
            <b>{formatDateTimeDE(round.starts_at)} – {formatDateTimeDE(round.ends_at)}</b>
          </div>
        </div>

        {isLive ? (
          <PublicVotingForm roundId={round.id} roundTitle={round.title} placesCount={round.places_count} songs={songs} />
        ) : (
          <section className="card">
            <h2>Endstand User-Voting</h2>
            <p>Gezählt werden nur per E-Mail bestätigte Stimmen.</p>
            <table>
              <thead>
                <tr><th>#</th><th>Song</th><th>Gesamt</th><th>Ø Punkte</th><th>Gewählt</th></tr>
              </thead>
              <tbody>
                {board.map((row, index) => (
                  <tr key={row.song.id}>
                    <td>{index + 1}</td>
                    <td><b>{row.song.title}</b><br /><small>{row.song.artist}</small></td>
                    <td>{row.total}</td>
                    <td>{row.avg.toFixed(2)}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="zonk-results">
              <h3>ZONK – Song der Woche</h3>
              {zonk.length ? (
                <ol>{zonk.map((entry) => <li key={entry.song.id}>{entry.song.title} — {entry.song.artist}: {entry.count}</li>)}</ol>
              ) : (
                <p>Noch keine ZONK-Stimmen vorhanden.</p>
              )}
            </div>
            <Link className="btn" href="/release-voting">Zur aktuellen Abstimmung</Link>
          </section>
        )}
        <footer><Link href="/impressum">Impressum</Link></footer>
      </section>
    </main>
  );
}
