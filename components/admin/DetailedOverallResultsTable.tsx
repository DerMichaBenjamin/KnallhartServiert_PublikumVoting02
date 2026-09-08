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

export default function DetailedOverallResultsTable({ songs, summary, juryData }: { songs: Song[]; summary: AdminRoundSummary; juryData: AdminJuryRoundData }) {
  const results = buildCombinedResults(songs, summary.leaderboard, summary.countedVotes, juryData);
  const jurors = results.activeJurors;
  const countedSources = results.submittedJurors.length + (summary.countedVotes > 0 ? 1 : 0);
  const zonkRows = buildCombinedZonkResults(songs, summary.zonk, juryData);
  const totalZonkVotes = zonkRows.reduce((sum, row) => sum + row.total, 0);

  return <>
    <section className="ks-card">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Endgültige Platzierung</span><h2>Gesamtwertung Jury + Publikum</h2><p>Hier stehen die Punkte jedes Jurymitglieds direkt am Song. <strong>Jury gesamt</strong> ist die Summe dieser Jury-Punkte, <strong>Ø Jury</strong> der Durchschnitt über alle tatsächlich abgegebenen Jurystimmen. Das Publikum zählt für die Gesamtwertung anschließend genau einmal als virtuelle 12-bis-1-Punkte-Stimme.</p></div></div>
      <div className="ks-table-scroll">
        <table className="ks-table results overall">
          <thead>
            <tr>
              <th rowSpan={2}>Platz</th><th rowSpan={2}>Song</th><th rowSpan={2}>Künstler</th>
              <th colSpan={Math.max(1, jurors.length) + 2}>Jury</th>
              <th rowSpan={2}>Publikum</th><th rowSpan={2}>Gesamt</th><th rowSpan={2}>Ø Gesamt</th>
            </tr>
            <tr>
              {jurors.length ? jurors.map((juror) => <th key={juror.id}>{juror.display_name}{!juror.submitted_at ? <><br /><small>offen</small></> : null}</th>) : <th>Keine Juroren</th>}
              <th>Jury gesamt</th><th>Ø Jury</th>
            </tr>
          </thead>
          <tbody>
            {results.overallRows.map((row) => <tr key={row.song.id}>
              <td><span className="ks-rank-pill">{rankLabel(row.rank)}</span></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist}</td>
              {jurors.length ? jurors.map((juror) => <td key={juror.id}>{juror.submitted_at ? (row.juryPointsByJuror[juror.id] || 0) : '—'}</td>) : <td>—</td>}
              <td><strong>{pointsLabel(row.juryPoints)}</strong></td><td><strong>{averageLabel(row.juryAverage)}</strong></td>
              <td>{pointsLabel(row.audiencePoints)}</td><td><strong>{pointsLabel(row.total)}</strong></td><td><strong>{averageLabel(row.overallAverage)}</strong></td>
            </tr>)}
            {!results.overallRows.length && <tr><td colSpan={8 + Math.max(1, jurors.length)} className="ks-table-empty">Keine Songs vorhanden.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="ks-table-footnote"><strong>Ø Jury</strong> = Jury-Gesamtpunkte ÷ {results.submittedJurors.length || 'Anzahl'} abgegebene Jurystimmen. Nicht platzierte Songs zählen innerhalb einer abgegebenen Jury-Stimme mit 0 Punkten. <strong>Ø Gesamt</strong> = Gesamtpunkte ÷ {countedSources || 'Anzahl'} tatsächlich gewertete Quellen (abgegebene Juroren + Publikum einmal). Nicht abgegebene Juroren werden nicht als 0 mitgerechnet.</p>
    </section>

    <section className="ks-card">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">ZONK gesamt</span><h2>Gesamt-ZONK Jury + Publikum</h2><p>Die einzelnen ZONK-Auswahlen aus Publikum und Jury werden separat ausgewiesen und anschließend zusammengezählt. Diese Negativwahl verändert die normale Gesamtpunktzahl nicht.</p></div></div>
      <div className="ks-table-scroll"><table className="ks-table results"><thead><tr><th>Platz</th><th>Song</th><th>Künstler</th><th>Publikum</th><th>Jury</th><th>Gesamt</th></tr></thead><tbody>{zonkRows.map((row) => <tr key={row.song.id}><td><span className="ks-rank-pill">#{row.rank}</span></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist}</td><td>{row.audienceCount}</td><td>{row.juryCount}</td><td><strong>{row.total}</strong></td></tr>)}{!zonkRows.length && <tr><td colSpan={6} className="ks-table-empty">Noch keine ZONK-Stimmen aus Jury oder Publikum vorhanden.</td></tr>}</tbody></table></div>
      <p className="ks-table-footnote">Insgesamt wurden {totalZonkVotes} ZONK-Auswahlen gewertet.</p>
    </section>
  </>;
}
