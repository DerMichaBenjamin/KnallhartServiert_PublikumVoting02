import type { AdminRoundSummary } from '@/lib/releaseVotingShared';
import { buildAudienceResults } from '@/lib/combinedVotingResults';
import { buildPublicZonkResults } from '@/lib/zonkResults';

export default function ResultsPublicTable({ summary }: { summary: AdminRoundSummary }) {
  const rows = buildAudienceResults(summary.leaderboard, summary.countedVotes);
  const publicZonkRows = buildPublicZonkResults(summary.zonk);
  const publicZonkVotes = publicZonkRows.reduce((sum, row) => sum + row.count, 0);

  return <>
    <section className="ks-card" id="public-results">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Publikums-Voting</span><h2>Publikumsergebnis</h2><p>„Publikumspunkte“ sind die tatsächlich summierten Punkte der Publikumsstimmen. „Ø Publikum“ teilt diese Summe durch alle gewerteten Publikumsstimmen; nicht gewählte Songs zählen in einer Stimme mit 0. Die Spalte „12–1 Punkte“ zeigt die daraus abgeleitete virtuelle Publikumsstimme für die Gesamtwertung.</p></div></div>
      <div className="ks-results-split"><div className="ks-table-scroll"><table className="ks-table results"><thead><tr><th>Platz</th><th>Song</th><th>Künstler</th><th>Publikumspunkte</th><th>Ø Publikum</th><th>Gewählt</th><th>Anteil</th><th>12–1 Punkte</th></tr></thead><tbody>{rows.map((row) => <tr key={row.song.id}><td><span className="ks-rank-pill">#{row.rank}</span></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist}</td><td>{row.total} Pkt.</td><td><strong>Ø {row.avg.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong></td><td>{row.count}</td><td>{summary.countedVotes ? `${((row.count / summary.countedVotes) * 100).toFixed(1)} %` : '—'}</td><td><strong>{row.audiencePoints} Pkt.</strong></td></tr>)}{!rows.length && <tr><td colSpan={8} className="ks-table-empty">Noch keine gewertete Publikumsrangliste vorhanden.</td></tr>}</tbody></table></div><aside className="ks-results-summary"><h3>Stimmenstatus</h3><dl><div><dt>Teilnehmer insgesamt</dt><dd>{summary.totalVotes}</dd></div><div className="success"><dt>Gewertet</dt><dd>{summary.countedVotes}</dd></div><div><dt>Bestätigt</dt><dd>{summary.confirmedVotes}</dd></div><div className="warning"><dt>Nicht bestätigt</dt><dd>{summary.unverifiedVotes}</dd></div><div className="warning"><dt>In Prüfung</dt><dd>{summary.reviewVotes}</dd></div><div className="danger"><dt>Ausgeschlossen</dt><dd>{summary.excludedVotes}</dd></div></dl><p>Nur bestätigte und aktuell gewertete Stimmen fließen in diese Rangliste ein.</p></aside></div>
    </section>

    <section className="ks-card">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Publikums-ZONK</span><h2>ZONK-Auswertung des Publikums</h2><p>{publicZonkVotes ? `${publicZonkVotes} gewertete Publikums-ZONK-Stimmen wurden abgegeben.` : 'Noch keine gewertete Publikums-ZONK-Stimme vorhanden.'}</p></div></div>
      <div className="ks-table-scroll"><table className="ks-table results"><thead><tr><th>Platz</th><th>Song</th><th>Künstler</th><th>ZONK-Stimmen Publikum</th><th>Anteil</th></tr></thead><tbody>{publicZonkRows.map((row) => <tr key={row.song.id}><td><span className="ks-rank-pill">#{row.rank}</span></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist}</td><td><strong>{row.count}</strong></td><td>{publicZonkVotes ? `${((row.count / publicZonkVotes) * 100).toFixed(1)} %` : '—'}</td></tr>)}{!publicZonkRows.length && <tr><td colSpan={5} className="ks-table-empty">Noch keine Publikums-ZONK-Stimmen vorhanden.</td></tr>}</tbody></table></div>
    </section>
  </>;
}
