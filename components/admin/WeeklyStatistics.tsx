import { StatCard } from './AdminUi';
import type { ReleaseWeekStatistics, WeekComparisonMetric } from '@/lib/releaseStatisticsCore';

function oneDecimal(value: number | null, suffix = '') {
  return value === null ? '—' : `${value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${suffix}`;
}

function compact(value: number | null, unit: WeekComparisonMetric['unit']) {
  if (value === null) return '—';
  if (unit === 'percent') return oneDecimal(value, ' %');
  if (unit === 'points') return oneDecimal(value);
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

function differenceLabel(value: number | null) {
  if (value === null) return '—';
  if (value === 0) return 'gleicher Rang';
  return value > 0 ? `Publikum +${value}` : `Jury +${Math.abs(value)}`;
}

export default function WeeklyStatistics({ stats, comparison }: { stats: ReleaseWeekStatistics; comparison: WeekComparisonMetric[] }) {
  const polarizing = [...stats.comparisonRows]
    .filter((row) => row.polarizationIndex !== null && (row.audienceMentions > 0 || row.juryPoints > 0))
    .sort((a, b) => (b.polarizationIndex || 0) - (a.polarizationIndex || 0));

  return <div className="ks-week-statistics" id="weekly-statistics">
    <section className="ks-stats-grid weekly-kpis">
      <StatCard label="Songs im Voting" value={stats.songsCount} />
      <StatCard label="Publikums-Votings" value={stats.totalVotes} />
      <StatCard label="Gültig / gewertet" value={stats.countedVotes} tone="success" />
      <StatCard label="Einzelwertungen" value={stats.individualRatings} hint="Nennungen von Publikum und Jury" />
      <StatCard label="Jury-Status" value={`${stats.submittedJurors}/${stats.activeJurors}`} hint="abgegeben / aktiv" tone={stats.submittedJurors === stats.activeJurors && stats.activeJurors > 0 ? 'success' : 'warning'} />
      <StatCard label="Abstand Platz 1–2" value={stats.winnerGap === null ? '—' : stats.winnerGap} hint="Gesamtpunkte" tone={stats.winnerGap !== null && stats.winnerGap <= 2 ? 'warning' : 'neutral'} />
      <StatCard label="Punkteanteil Top 3" value={oneDecimal(stats.top3Share, ' %')} />
      <StatCard label="Punkteanteil Top 5" value={oneDecimal(stats.top5Share, ' %')} />
      <StatCard label="Songs ohne Punkte" value={stats.songsWithoutPoints} tone={stats.songsWithoutPoints ? 'warning' : 'success'} />
      <StatCard label="Songs ohne Nennung" value={stats.songsWithoutRatings} hint="weder Publikum noch Jury" tone={stats.songsWithoutRatings ? 'warning' : 'success'} />
    </section>

    <section className="ks-card ks-stat-section" id="highlights">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Redaktioneller Überblick</span><h2>Besonderheiten dieser Woche</h2><p>Automatisch aus den vorhandenen Ergebnissen abgeleitet – ohne KI-Schätzung.</p></div></div>
      {stats.highlights.length ? <div className="ks-highlight-grid">{stats.highlights.map((highlight) => <article key={highlight.key} className={`ks-highlight-card ${highlight.tone}`}><span>{highlight.title}</span><strong>{highlight.value}</strong><p>{highlight.detail}</p></article>)}</div> : <p className="ks-muted-copy">Für belastbare Besonderheiten liegen noch nicht genügend abgeschlossene Wertungen vor.</p>}
    </section>

    <section className="ks-card ks-stat-section" id="audience-jury">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Rangvergleich</span><h2>Publikum vs. Jury</h2><p>Positive Differenz bedeutet: Der Song steht beim Publikum besser. Negative Differenz bedeutet: Die Jury setzt ihn höher.</p></div></div>
      <div className="ks-table-scroll"><table className="ks-table stats-comparison"><thead><tr><th>Gesamt</th><th>Song</th><th>Künstler</th><th>Publikum</th><th>Jury</th><th>Differenz</th><th>Publikumsnennungen</th></tr></thead><tbody>{stats.comparisonRows.map((row) => <tr key={row.song.id}><td><span className="ks-rank-pill">{row.overallRank ?? '—'}</span></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist}</td><td>{row.audienceRank ?? '—'}</td><td>{row.juryRank ?? '—'}</td><td><span className={`ks-rank-difference ${(row.rankDifference || 0) > 0 ? 'audience' : (row.rankDifference || 0) < 0 ? 'jury' : ''}`}>{differenceLabel(row.rankDifference)}</span></td><td>{row.audienceMentions}</td></tr>)}</tbody></table></div>
    </section>

    <section className="ks-card ks-stat-section" id="polarization">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Einigkeit und Uneinigkeit</span><h2>Polarisierungsindex</h2><p>0 steht für vollständige Einigkeit, 100 für die maximal mögliche Streuung auf der 0-bis-12-Punkte-Skala.</p></div><div className="ks-polarization-summary"><span>Wochendurchschnitt</span><strong>{oneDecimal(stats.averagePolarization)}</strong></div></div>
      <div className="ks-polarization-list">{polarizing.map((row) => <div key={row.song.id}><div><strong>{row.song.title}</strong><small>{row.song.artist} · {row.polarizationLabel}</small></div><div className="ks-polarization-track"><i style={{ width: `${row.polarizationIndex || 0}%` }} /></div><b>{row.polarizationIndex}</b></div>)}{!polarizing.length && <p className="ks-muted-copy">Mindestens zwei abgeschlossene Bewertungsstimmen werden für den Index benötigt.</p>}</div>
      <details className="ks-method-note"><summary>Berechnung nachvollziehen</summary><p>Berücksichtigt werden alle abgeschlossenen Juroren sowie das Publikum als eine aggregierte Stimme – entsprechend der bestehenden Gesamtwertung. Nicht platzierte Songs erhalten innerhalb dieser Berechnung 0 Punkte. Die Standardabweichung wird durch den theoretischen Höchstwert 6 geteilt und auf 0–100 skaliert. Die Ergebnisplatzierung selbst wird dadurch nicht verändert.</p></details>
    </section>

    <section className="ks-card ks-stat-section" id="week-comparison">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Historischer Kontext</span><h2>Diese Woche im Vergleich</h2><p>Vergleich mit dem Durchschnitt aller anderen tatsächlich durchgeführten Voting-Wochen.</p></div></div>
      <div className="ks-week-comparison-grid">{comparison.map((item) => <article key={item.key}><span>{item.label}</span><strong>{compact(item.current, item.unit)}</strong><small>Historischer Ø: {compact(item.average, item.unit)}</small><b className={(item.delta || 0) > 0 ? 'positive' : (item.delta || 0) < 0 ? 'negative' : ''}>{item.delta === null ? 'Kein Vergleich' : `${item.delta > 0 ? '+' : ''}${compact(item.delta, item.unit)}`}</b></article>)}</div>
    </section>
  </div>;
}
