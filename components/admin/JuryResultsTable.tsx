import type { AdminRoundSummary, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { buildCombinedResults, compareResultSongs, type CombinedResultRow } from '@/lib/combinedVotingResults';

function averageLabel(value: number | null) {
  return value === null ? '—' : value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function withJuryRanks(rows: CombinedResultRow[], hasVotes: boolean) {
  const sorted = [...rows].sort((a, b) => b.juryPoints - a.juryPoints || (b.juryAverage || 0) - (a.juryAverage || 0) || compareResultSongs(a.song, b.song));
  let previousPoints: number | null = null;
  let previousRank = 0;
  return sorted.map((row, index) => {
    if (!hasVotes) return { ...row, juryRank: null as number | null };
    const rank = previousPoints === row.juryPoints ? previousRank : index + 1;
    previousPoints = row.juryPoints;
    previousRank = rank;
    return { ...row, juryRank: rank as number | null };
  });
}

export default function JuryResultsTable({ songs, summary, juryData }: { songs: Song[]; summary: AdminRoundSummary; juryData: AdminJuryRoundData }) {
  const results = buildCombinedResults(songs, summary.leaderboard, summary.countedVotes, juryData);
  const jurors = results.activeJurors;
  const rows = withJuryRanks(results.overallRows, results.submittedJurors.length > 0);

  return <section className="ks-card">
    <div className="ks-section-heading"><div><span className="ks-section-kicker">Jury nach Songs</span><h2>Punkte je Song</h2><p>Die Einzelspalten zeigen die Punkte jedes Jurymitglieds. Nicht platzierte Songs zählen bei einer abgegebenen Jury-Stimme mit 0 Punkten. <strong>Ø Jury</strong> ist Jury-Gesamtpunkte geteilt durch die Zahl der tatsächlich abgegebenen Jurystimmen. Das Publikum steht nur zum Vergleich daneben und fließt nicht in Ø Jury ein.</p></div></div>
    <div className="ks-table-scroll">
      <table className="ks-table results overall">
        <thead>
          <tr>
            <th rowSpan={2}>Jury-Platz</th><th rowSpan={2}>Song</th><th rowSpan={2}>Künstler</th>
            <th colSpan={Math.max(1, jurors.length)}>Einzelne Jury-Punkte</th>
            <th rowSpan={2}>Jury gesamt</th><th rowSpan={2}>Ø Jury</th><th rowSpan={2}>Publikum 12–1</th>
          </tr>
          <tr>
            {jurors.length ? jurors.map((juror) => <th key={juror.id}>{juror.display_name}{!juror.submitted_at ? <><br /><small>offen</small></> : null}</th>) : <th>Keine Juroren</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => <tr key={row.song.id}>
            <td><span className="ks-rank-pill">{row.juryRank === null ? '—' : `#${row.juryRank}`}</span></td>
            <td><strong>{row.song.title}</strong></td><td>{row.song.artist}</td>
            {jurors.length ? jurors.map((juror) => <td key={juror.id}>{juror.submitted_at ? (row.juryPointsByJuror[juror.id] || 0) : '—'}</td>) : <td>—</td>}
            <td><strong>{row.juryPoints} Pkt.</strong></td><td><strong>Ø {averageLabel(row.juryAverage)}</strong></td><td>{row.audiencePoints} Pkt.</td>
          </tr>)}
          {!rows.length && <tr><td colSpan={6 + Math.max(1, jurors.length)} className="ks-table-empty">Keine Songs vorhanden.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
