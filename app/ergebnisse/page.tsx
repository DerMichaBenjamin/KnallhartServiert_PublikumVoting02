import Header from '@/components/Header';
import { combineSongLine, getRoundResults, listPublicResultRounds, type LeaderboardRow, type Round, type ZonkRow } from '@/lib/releaseVoting';
import { formatDateTimeDE } from '@/lib/dateTime';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type ResultBlock = {
  round: Round;
  board: LeaderboardRow[];
  zonk: ZonkRow[];
  validVotes: number;
  songsCount: number;
};

export default async function Ergebnisse() {
  const rounds = await listPublicResultRounds();

  const blocks: ResultBlock[] = await Promise.all(
    rounds.map(async (round) => {
      const results = await getRoundResults(round.id);
      return {
        round,
        board: results.leaderboard,
        zonk: results.zonk.filter((entry) => entry.count > 0),
        validVotes: results.validVotes,
        songsCount: results.songsCount,
      };
    })
  );

  return (
    <main className="public-shell simple-page-shell">
      <Header />

      <section className="card simple-page-card">
        <h1>Ergebnisse bisheriger Abstimmungen</h1>
        <p>
          Hier erscheinen nur Abstimmungen, die im Backend für die öffentliche Ergebnisübersicht freigegeben sind.
          Gezählt werden nur per E-Mail bestätigte Stimmen. Angezeigt werden alle Songs der jeweiligen Abstimmung,
          auch Songs mit 0 Punkten.
        </p>

        {!blocks.length && <p>Noch keine öffentlichen Ergebnisse.</p>}

        {blocks.length > 1 && (
          <div className="result-index">
            <h2>Abstimmungen</h2>
            <ul>
              {blocks.map(({ round, validVotes, songsCount }) => (
                <li key={round.id}>
                  <Link href={`/ergebnisse/${round.slug}`}>{round.title}</Link>{' '}
                  <small>
                    {validVotes} gültige Stimmen · {songsCount} Songs
                  </small>
                </li>
              ))}
            </ul>
          </div>
        )}

        {blocks.map(({ round, board, zonk, validVotes, songsCount }) => (
          <section className="result-block" id={round.slug} key={round.id}>
            <h2>{round.title}</h2>
            <p>
              {validVotes} gültige Stimmen · {songsCount} Songs
              {round.starts_at || round.ends_at ? (
                <>
                  {' · '}
                  {formatDateTimeDE(round.starts_at)} – {formatDateTimeDE(round.ends_at)}
                </>
              ) : null}
            </p>

            <div className="result-actions">
              <Link className="btn primary" href={`/release-voting/${round.slug}`}>
                Abstimmung öffnen
              </Link>
              <Link className="btn" href={`/ergebnisse/${round.slug}`}>
                Direkter Ergebnis-Link
              </Link>
            </div>

            <div className="admin-table-wrap compact">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Song</th>
                    <th>Gesamt</th>
                    <th>Ø Punkte</th>
                    <th>Gewählt</th>
                  </tr>
                </thead>
                <tbody>
                  {board.map((row, index) => (
                    <tr key={row.song.id}>
                      <td>{index + 1}</td>
                      <td>{combineSongLine(row.song)}</td>
                      <td>{row.total}</td>
                      <td>{row.avg.toFixed(2)}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}

                  {!board.length && (
                    <tr>
                      <td colSpan={5}>Keine Songs in dieser Umfrage vorhanden.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="zonk-results">
              <h3>ZONK – Song der Woche</h3>
              {zonk.length ? (
                <ol>
                  {zonk.map((entry) => (
                    <li key={entry.song.id}>
                      {combineSongLine(entry.song)}: <b>{entry.count}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Noch keine bestätigten ZONK-Stimmen vorhanden.</p>
              )}
            </div>
          </section>
        ))}
      </section>
      <footer className="legal-footer"><Link href="/datenschutz">Datenschutz</Link><Link href="/impressum">Impressum</Link></footer>
    </main>
  );
}
