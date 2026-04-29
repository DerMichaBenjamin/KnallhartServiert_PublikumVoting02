import Link from 'next/link';
import { notFound } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import MissingSongsBox from '@/components/MissingSongsBox';
import PublicVotingForm from '@/components/PublicVotingForm';
import SpotifyPlaylistEmbed from '@/components/SpotifyPlaylistEmbed';
import {
  filterVerifiedVotes,
  formatDateTime,
  getPublicRoundState,
  getRoundBySlug,
  getVotesForRound,
  leaderboardFromVotes,
  publicStatusLabel,
  shuffleSongs,
  zonkLeaderboardFromVotes,
} from '@/lib/releaseVoting';

export const dynamic = 'force-dynamic';

export default async function ReleaseVotingSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: round } = await getRoundBySlug(slug);

  if (!round) notFound();

  const { data: allVotes } = await getVotesForRound(round.id);
  const verifiedVotes = filterVerifiedVotes(allVotes ?? []);
  const publicState = getPublicRoundState(round);
  const leaderboard = publicState === 'ended' ? leaderboardFromVotes(round.songs_json, verifiedVotes) : [];
  const zonkLeaderboard = publicState === 'ended' ? zonkLeaderboardFromVotes(round.songs_json, verifiedVotes) : [];

  return (
    <main className="public-shell voting-page-shell">
      <aside className="desktop-playlist-sidebar">
        <div className="playlist-sticky">
          <BrandLogo compact />
          <div className="sidebar-title">SONG-PLAYLIST</div>
          <p>Hör rein in unsere Playlist mit allen Songs zur Abstimmung.</p>
          <SpotifyPlaylistEmbed playlistId={round.spotify_playlist_id} />
          <MissingSongsBox />
        </div>
      </aside>

      <section className="voting-main-stage">
        <header className="voting-header">
          <nav className="voting-nav">
            <BrandLogo compact />
            <div className="nav-links">
              <span>Voting</span>
              <span>Ergebnisse</span>
              <span>Kontakt</span>
            </div>
          </nav>

          <h1>Knallhart serviert <span>Publikums-Voting</span></h1>
          <p>Wähle deine 12 Favoriten und bestätige deine Stimme per E-Mail.</p>

          <div className="mobile-playlist-panel">
            <SpotifyPlaylistEmbed playlistId={round.spotify_playlist_id} />
            <MissingSongsBox />
          </div>

          <div className="voting-status-grid">
            <div className="status-card">
              <div className="status-icon">✓</div>
              <div>
                <div className="small-text">Dein Voting-Status</div>
                <strong>{publicStatusLabel(publicState)}</strong>
              </div>
            </div>
            <div className="status-card">
              <div className="status-icon">□</div>
              <div>
                <div className="small-text">Abstimmungszeitraum</div>
                <strong>{formatDateTime(round.start_at)} – {formatDateTime(round.end_at)}</strong>
              </div>
            </div>
          </div>
        </header>

        {publicState === 'upcoming' && <div className="notice warn">Diese Abstimmung startet bald.</div>}
        {publicState === 'draft' && <div className="notice warn">Diese Abstimmung ist noch nicht freigeschaltet.</div>}

        {publicState === 'live' && (
          <PublicVotingForm roundId={round.id} roundTitle={round.title} placesCount={round.places_count} songs={shuffleSongs(round.songs_json)} />
        )}

        {publicState === 'ended' && (
          <section className="table-card results-end-card">
            <div className="section-head compact-gap">
              <div>
                <h2 className="section-title">Endstand User-Voting</h2>
                <p className="section-subtitle">Gezählt werden nur per E-Mail bestätigte Stimmen.</p>
              </div>
              <Link className="button secondary small" href="/release-voting">Zur aktuellen Abstimmung</Link>
            </div>

            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Song</th><th>Gesamt</th><th>Ø Punkte</th><th>Gewählt</th></tr></thead>
                <tbody>
                  {leaderboard.length === 0 && <tr><td colSpan={5}><div className="empty-state">Noch keine bestätigten Stimmen vorhanden.</div></td></tr>}
                  {leaderboard.map((row) => (
                    <tr key={row.song}>
                      <td>{row.rank}</td>
                      <td><strong>{row.title}</strong><div className="small-text">{row.artist}</div></td>
                      <td>{row.totalPoints}</td>
                      <td>{row.averagePoints.toFixed(2)}</td>
                      <td>{row.voteCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="zonk-results-box">
              <h3>Z-O-N-K – Song der Woche</h3>
              {zonkLeaderboard.length === 0 ? (
                <p className="small-text">Noch keine Z-O-N-K-Stimmen vorhanden.</p>
              ) : (
                <ol>
                  {zonkLeaderboard.map((row) => <li key={row.song}><strong>{row.title}</strong> <span>{row.artist}</span> — {row.count} Stimme(n)</li>)}
                </ol>
              )}
            </div>
          </section>
        )}
      </section>

      <footer className="public-legal-footer">
        <Link href="/impressum">Impressum</Link>
      </footer>
    </main>
  );
}
