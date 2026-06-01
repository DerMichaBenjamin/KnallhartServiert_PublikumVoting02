import Header from '@/components/Header';
import { combineSongLine, getRoundBySlug, getRoundResults } from '@/lib/releaseVoting';
import { formatDateTimeDE } from '@/lib/dateTime';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ErgebnisDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const round = await getRoundBySlug(slug);

  if (!round) notFound();

  if (!round.is_public_results) {
    return (
      <main className="public-shell simple-page-shell">
        <Header />
        <section className="card simple-page-card">
          <h1>Ergebnis nicht öffentlich</h1>
          <p>Dieses Ergebnis wurde im Backend noch nicht für die öffentliche Ansicht freigegeben.</p>
          <Link className="btn" href="/ergebnisse">Zur Ergebnisübersicht</Link>
        </section>
        <footer className="legal-footer"><Link href="/datenschutz">Datenschutz</Link><Link href="/impressum">Impressum</Link></footer>
      </main>
    );
  }

  const results = await getRoundResults(round.id);
  const zonk = results.zonk.filter((entry) => entry.count > 0);

  return (
    <main className="public-shell simple-page-shell">
      <Header />

      <section className="card simple-page-card result-block">
        <p><Link href="/ergebnisse">← Alle Ergebnisse</Link></p>
        <h1>{round.title}</h1>
        <p>
          {results.validVotes} gültige Stimmen · {results.songsCount} Songs
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
          <Link className="btn" href="/ergebnisse">
            Alle bisherigen Ergebnisse
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
              {results.leaderboard.map((row, index) => (
                <tr key={row.song.id}>
                  <td>{index + 1}</td>
                  <td>{combineSongLine(row.song)}</td>
                  <td>{row.total}</td>
                  <td>{row.avg.toFixed(2)}</td>
                  <td>{row.count}</td>
                </tr>
              ))}

              {!results.leaderboard.length && (
                <tr>
                  <td colSpan={5}>Keine Songs in dieser Umfrage vorhanden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="zonk-results">
          <h2>ZONK – Song der Woche</h2>
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

      <footer className="legal-footer"><Link href="/datenschutz">Datenschutz</Link><Link href="/impressum">Impressum</Link></footer>
    </main>
  );
}
