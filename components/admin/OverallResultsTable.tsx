import type { AdminRoundSummary, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { buildCombinedResults } from '@/lib/combinedVotingResults';
import { buildCombinedZonkResults } from '@/lib/zonkResults';

function rankLabel(value: number | null) {
  return value === null ? '—' : `#${value}`;
}

function pointsLabel(value: number) {
  return `${value} Pkt.`;
}

function averageLabel(value: number | null) {
  return value === null ? '—' : `Ø ${value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

export default function OverallResultsTable({ songs, summary, juryData }: { songs: Song[]; summary: AdminRoundSummary; juryData: AdminJuryRoundData }) {
  const results = buildCombinedResults(songs, summary.leaderboard, summary.countedVotes, juryData);
  const countedSources = results.submittedJurors.length + (summary.countedVotes > 0 ? 1 : 0);
  const zonkRows = buildCombinedZonkResults(songs, summary.zonk, juryData);
  const totalZonkVotes = zonkRows.reduce((sum, row) => sum + row.total, 0);

  return <section className="ks-card">
    <div className="ks-section-heading"><div><span className="ks-section-kicker">Endgültige Platzierung</span><h2>Gesamtwertung Jury + Publikum</h2><p>Gesamtpunkte sind die Summe aller abgegebenen Jury-Wertungen plus der aggregierten Publikumswertung. Ø Punkte teilt diese Gesamtpunkte durch alle tatsächlich eingegangenen Wertungsstimmen; das Publikum zählt dabei genau einmal.</p></div></div>
    <div className="ks-table-scroll"><table className="ks-table results overall"><thead><tr><th>Platz</th><th>Song</th><th>Künstler</th><th>Jury-Punkte</th><th>Publikum-Punkte</th><th>Gesamtpunkte</th><th>Ø Punkte</th></tr></thead><tbody>{results.overallRows.map((row) => <tr key={row.song.id}><td><span className="ks-rank-pill">{rankLabel(row.rank)}</span></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist}</td><td>{pointsLabel(row.juryPoints)}</td><td>{pointsLabel(row.audiencePoints)}</td><td><strong>{pointsLabel(row.total)}</strong></td><td><strong>{averageLabel(row.overallAverage)}</strong></td></tr>)}{!results.overallRows.length && <tr><td colSpan={7} className="ks-table-empty">Keine Songs vorhanden.</td></tr>}</tbody></table></div>
    <p className="ks-table-footnote"><strong>Ø Punkte</strong> = Gesamtpunkte ÷ {countedSources || 'Anzahl'} tatsächlich gewertete Quellen (abgegebene Juroren + Publikum einmal). Nicht abgegebene Juroren werden nicht als 0 mitgerechnet. Bei identischer Gesamtpunktzahl wird derselbe Platz vergeben.</p>

    <div className="ks-section-heading"><div><span className="ks-section-kicker">ZONK gesamt</span><h3>Gesamt-ZONK Jury + Publikum</h3><p>Hier werden die einzelnen ZONK-Auswahlen aus Publikum und Jury zusammengezählt. Jede tatsächliche ZONK-Auswahl zählt genau eine Stimme; die Spalten zeigen transparent, woher sie kommt.</p></div></div>
    <div className="ks-table-scroll"><table className="ks-table results"><thead><tr><th>Platz</th><th>Song</th><th>Künstler</th><th>Publikum</th><th>Jury</th><th>Gesamt</th></tr></thead><tbody>{zonkRows.map((row) => <tr key={row.song.id}><td><span className="ks-rank-pill">#{row.rank}</span></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist}</td><td>{row.audienceCount}</td><td>{row.juryCount}</td><td><strong>{row.total}</strong></td></tr>)}{!zonkRows.length && <tr><td colSpan={6} className="ks-table-empty">Noch keine ZONK-Stimmen aus Jury oder Publikum vorhanden.</td></tr>}</tbody></table></div>
    <p className="ks-table-footnote">Insgesamt wurden {totalZonkVotes} ZONK-Auswahlen gewertet. Diese ZONK-Auswertung ist eine eigene Negativwahl und verändert die normale Gesamtpunktzahl nicht.</p>
  </section>;
}
