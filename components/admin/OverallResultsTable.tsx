import type { AdminRoundSummary, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { buildCombinedResults } from '@/lib/combinedVotingResults';

export default function OverallResultsTable({ songs, summary, juryData }: { songs: Song[]; summary: AdminRoundSummary; juryData: AdminJuryRoundData }) {
  const results = buildCombinedResults(songs, summary.leaderboard, summary.countedVotes, juryData);
  return <section className="ks-card"><div className="ks-section-heading"><div><span className="ks-section-kicker">Endgültige Platzierung</span><h2>Gesamtwertung Jury + Publikum</h2><p>Jury-Punkte plus Publikumspunkte nach der bestehenden 12-bis-1-Logik.</p></div></div><div className="ks-table-scroll"><table className="ks-table results overall"><thead><tr><th>Platz</th><th>Song</th><th>Künstler</th><th>Jury-Punkte</th><th>Publikum-Punkte</th><th>Gesamtpunkte</th></tr></thead><tbody>{results.overallRows.map((row) => <tr key={row.song.id}><td><span className="ks-rank-pill">{row.rank ?? '—'}</span></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist}</td><td>{row.juryPoints}</td><td>{row.audiencePoints}</td><td><strong>{row.total}</strong></td></tr>)}{!results.overallRows.length && <tr><td colSpan={6} className="ks-table-empty">Keine Songs vorhanden.</td></tr>}</tbody></table></div><p className="ks-table-footnote">Bei identischer Gesamtpunktzahl wird derselbe Platz vergeben. Die alphabetische Sortierung entspricht der bisherigen Matrixlogik und verändert die Punktzahl nicht.</p></section>;
}
