import type { ArtistHistory, ReleaseWeekStatistics } from '@/lib/releaseStatisticsCore';
import { formatAdminDate } from '@/lib/adminUi';
import ArtistHistoryExplorer from './ArtistHistoryExplorer';
import RoundStatisticsPicker from './RoundStatisticsPicker';

function decimal(value: number | null, suffix = '') {
  return value === null ? '—' : `${value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${suffix}`;
}

export default function StatisticsOverview({ weeks, artists }: { weeks: ReleaseWeekStatistics[]; artists: ArtistHistory[] }) {
  const conducted = weeks.filter((week) => week.hasActivity);
  const current = conducted.find((week) => week.round.is_current) || conducted[0] || null;
  const recent = conducted.slice(0, 12);
  const maxVotes = Math.max(1, ...recent.map((week) => week.countedVotes));

  return <>
    {current && <section className="ks-card ks-current-statistics-card">
      <div><span className="ks-section-kicker">Aktuelle Auswertung</span><h2>{current.round.title}</h2><p>{formatAdminDate(current.round.starts_at || current.round.created_at)} · {current.countedVotes} gewertete Publikumsstimmen · Jury {current.submittedJurors}/{current.activeJurors}</p></div>
      <div className="ks-current-statistics-metrics"><span><small>Sieger-Abstand</small><strong>{current.winnerGap ?? '—'}</strong></span><span><small>Top-3-Anteil</small><strong>{decimal(current.top3Share, ' %')}</strong></span><span><small>Ø Polarisation</small><strong>{decimal(current.averagePolarization)}</strong></span></div>
      <div className="ks-inline-actions"><a className="ks-button primary" href={`/admin/release-voting/${current.round.id}/statistics`}>Wochenstatistik öffnen</a><a className="ks-button secondary" href={`/admin/release-voting/${current.round.id}/results`}>Ergebnisse öffnen</a></div>
    </section>}

    <section className="ks-card ks-stat-section">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Wochenverlauf</span><h2>Die letzten durchgeführten Umfragen</h2><p>Nur Runden mit tatsächlicher Publikums- oder Juryaktivität.</p></div><RoundStatisticsPicker rounds={conducted.map((week) => ({ id: week.round.id, title: week.round.title, date: week.round.starts_at || week.round.created_at }))} /></div>
      <div className="ks-stat-bars detailed">{recent.map((week) => <a key={week.round.id} href={`/admin/release-voting/${week.round.id}/statistics`} className="ks-stat-bar-row"><div><strong>{week.round.title}</strong><small>{formatAdminDate(week.round.starts_at || week.round.created_at)}</small></div><div className="ks-stat-bar"><i style={{ width: `${Math.round((week.countedVotes / maxVotes) * 100)}%` }} /><span>{week.countedVotes}</span></div><small>Top 3: {decimal(week.top3Share, ' %')} · Pol.: {decimal(week.averagePolarization)}</small></a>)}{!recent.length && <p>Noch keine durchgeführte Umfrage vorhanden.</p>}</div>
    </section>

    <ArtistHistoryExplorer artists={artists} />
  </>;
}
