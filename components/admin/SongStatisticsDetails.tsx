import type { RankingComparisonRow } from '@/lib/releaseStatisticsCore';

function decimal(value: number | null) {
  return value === null ? '—' : value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function difference(value: number | null) {
  if (value === null) return '—';
  if (value === 0) return 'gleicher Rang';
  return value > 0 ? `Publikum +${value}` : `Jury +${Math.abs(value)}`;
}

export default function SongStatisticsDetails({ rows }: { rows: RankingComparisonRow[] }) {
  return <section className="ks-card ks-stat-section" id="song-statistics">
    <div className="ks-section-heading"><div><span className="ks-section-kicker">Details je Titel</span><h2>Songstatistiken</h2><p>Zeile öffnen, um Einzelwertungen, Streuung und Bewertungsverteilung zu sehen.</p></div></div>
    <div className="ks-song-stat-list">
      {rows.map((row) => {
        const maxDistribution = Math.max(1, ...row.detail.distribution);
        return <details key={row.song.id} id={`song-stat-${row.song.id}`}>
          <summary>
            <span className="ks-rank-pill">{row.overallRank ?? '—'}</span>
            <span className="ks-song-stat-title"><strong>{row.song.title}</strong><small>{row.song.artist}</small></span>
            <span><small>Gesamt</small><strong>{row.total}</strong></span>
            <span><small>Publikum / Jury</small><strong>{row.audienceRank ?? '—'} / {row.juryRank ?? '—'}</strong></span>
            <span><small>Polarisation</small><strong>{row.polarizationIndex ?? '—'}</strong></span>
            <b aria-hidden="true">⌄</b>
          </summary>
          <div className="ks-song-stat-panel">
            <div className="ks-song-stat-metrics">
              <span><small>Gesamtplatz</small><strong>{row.overallRank ?? '—'}</strong></span>
              <span><small>Gesamtpunkte</small><strong>{row.total}</strong></span>
              <span><small>Publikumsplatz</small><strong>{row.audienceRank ?? '—'}</strong></span>
              <span><small>Juryplatz</small><strong>{row.juryRank ?? '—'}</strong></span>
              <span><small>Differenz</small><strong>{difference(row.rankDifference)}</strong></span>
              <span><small>Ø Einzelbewertung</small><strong>{decimal(row.detail.averageRating)}</strong></span>
              <span><small>Höchste Bewertung</small><strong>{row.detail.highestRating ?? '—'}</strong></span>
              <span><small>Niedrigste Bewertung</small><strong>{row.detail.lowestRating ?? '—'}</strong></span>
              <span><small>12-Punkte-Wertungen</small><strong>{row.detail.topRatings}</strong></span>
              <span><small>Nullwertungen</small><strong>{row.detail.zeroRatings}</strong></span>
              <span><small>Streuung</small><strong>{decimal(row.detail.standardDeviation)}</strong></span>
              <span><small>Polarisierungsindex</small><strong>{row.polarizationIndex === null ? '—' : `${row.polarizationIndex}/100`}</strong></span>
            </div>
            <div className="ks-rating-distribution" aria-label={`Bewertungsverteilung für ${row.song.title}`}>
              {row.detail.distribution.map((count, points) => <div key={points}><span>{points}</span><i><b style={{ height: count ? `${Math.max(6, (count / maxDistribution) * 100)}%` : '0' }} /></i><strong>{count}</strong></div>)}
            </div>
            <p className="ks-song-stat-note">Ø, Minimum, Maximum und Streuung basieren auf {row.detail.ratingCount} gewerteten Einzelstimmen aus Publikum und abgegebener Jury. Nicht platzierte Songs zählen dabei mit 0. Der offizielle Polarisierungsindex behandelt das Publikum weiterhin wie in der Gesamtwertung als eine aggregierte 12-bis-1-Stimme.</p>
          </div>
        </details>;
      })}
      {!rows.length && <p className="ks-muted-copy">Noch keine Songs vorhanden.</p>}
    </div>
  </section>;
}
