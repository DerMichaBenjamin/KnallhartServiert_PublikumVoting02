import Link from 'next/link';
import Header from '@/components/Header';
import SpotifySidebar from '@/components/SpotifySidebar';
import PublicVotingForm from '@/components/PublicVotingForm';
import { getRoundResults, getSongs, type Round } from '@/lib/releaseVoting';
import { formatDateTimeDE } from '@/lib/dateTime';

type VotingRoundViewProps = {
  round: Round;
  variant?: 'public' | 'dj';
};

export default async function VotingRoundView({ round, variant = 'public' }: VotingRoundViewProps) {
  const isDj = variant === 'dj';
  const titleLabel = isDj ? 'DJ-Voting' : 'Publikums-Voting';
  const resultLabel = isDj ? 'Endstand DJ-Voting' : 'Endstand User-Voting';
  const backHref = isDj ? '/dj-voting' : '/release-voting';
  const backLabel = isDj ? 'Zum aktuellen DJ-Voting' : 'Zur aktuellen Abstimmung';

  const now = Date.now();
  const isLive =
    round.status === 'live' &&
    (!round.starts_at || Date.parse(round.starts_at) <= now) &&
    (!round.ends_at || Date.parse(round.ends_at) >= now);

  const shouldShowResults = !isLive && round.is_public_results;
  const songs = shouldShowResults ? [] : await getSongs(round.id);
  const results = shouldShowResults ? await getRoundResults(round.id) : null;
  const publicSongs = shouldShowResults ? results!.songs : songs;
  const board = shouldShowResults ? results!.leaderboard : [];
  const zonk = shouldShowResults ? results!.zonk.filter((entry) => entry.count > 0) : [];

  return (
    <main className="voting-page">
      <SpotifySidebar playlistId={round.spotify_playlist_id} />
      <section className="voting-main">
        <Header />
        <h1>
          Knallhart serviert<br />
          <span>{titleLabel}</span>
        </h1>
        <p>Wähle deine 12 Favoriten und bestätige deine Stimme per E-Mail.</p>

        <div className="status-grid">
          <div className="status-card">
            <small>Voting-Status</small>
            <b>{isLive ? 'Noch keine Auswahl' : 'Beendet'}</b>
          </div>
          <div className="status-card">
            <small>Abstimmungszeitraum</small>
            <b>{formatDateTimeDE(round.starts_at)} – {formatDateTimeDE(round.ends_at)}</b>
          </div>
        </div>

        {isLive ? (
          <PublicVotingForm roundId={round.id} roundTitle={round.title} placesCount={round.places_count} songs={publicSongs} />
        ) : shouldShowResults ? (
          <section className="card">
            <h2>{resultLabel}</h2>
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
                <p>Noch keine bestätigten ZONK-Stimmen vorhanden.</p>
              )}
            </div>
            <Link className="btn" href={backHref}>{backLabel}</Link>
          </section>
        ) : (
          <section className="card">
            <h2>Abstimmung beendet</h2>
            <p>Das Ergebnis wurde noch nicht öffentlich freigegeben.</p>
            <p>Private oder interne Abstimmungen bleiben damit auch nach Ende vor öffentlicher Einsicht geschützt.</p>
            <Link className="btn" href={backHref}>{backLabel}</Link>
          </section>
        )}
        <footer className="legal-footer"><Link href="/datenschutz">Datenschutz</Link><Link href="/impressum">Impressum</Link></footer>
      </section>
    </main>
  );
}
