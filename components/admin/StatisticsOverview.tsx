import type { Round } from '@/lib/releaseVotingShared';
import type { AdminRoundOverview } from '@/lib/adminOverview';
import { formatAdminDate } from '@/lib/adminUi';
import HistoricalStatisticsLoader from './HistoricalStatisticsLoader';

export default function StatisticsOverview({ rounds, overviews }: { rounds: Round[]; overviews: AdminRoundOverview[] }) {
  const byId = new Map(overviews.map((overview) => [overview.roundId, overview]));
  const conducted = rounds.filter((round) => {
    const overview = byId.get(round.id);
    return Boolean((overview?.totalVotes || 0) > 0 || (overview?.jurySubmitted || 0) > 0);
  });
  const current = rounds.find((round) => round.is_current) || conducted[0] || rounds[0] || null;
  const currentOverview = current ? byId.get(current.id) : null;
  const maxVotes = Math.max(1, ...conducted.map((round) => byId.get(round.id)?.countedVotes || 0));

  return <>
    {current && <section className="ks-card ks-current-statistics-card">
      <div><span className="ks-section-kicker">Aktuelle Auswertung</span><h2>{current.title}</h2><p>{formatAdminDate(current.starts_at || current.created_at)} · {currentOverview?.countedVotes || 0} gewertete Publikumsstimmen · Jury {currentOverview?.jurySubmitted || 0}/{currentOverview?.jurorsCount || 0}</p></div>
      <div className="ks-current-statistics-metrics"><span><small>Songs</small><strong>{currentOverview?.songsCount || 0}</strong></span><span><small>Stimmen gesamt</small><strong>{currentOverview?.totalVotes || 0}</strong></span><span><small>Gewertet</small><strong>{currentOverview?.countedVotes || 0}</strong></span></div>
      <div className="ks-inline-actions"><a className="ks-button primary" href={`/admin/release-voting/${current.id}/statistics`}>Wochenstatistik öffnen</a><a className="ks-button secondary" href={`/admin/release-voting/${current.id}/results`}>Ergebnisse öffnen</a></div>
    </section>}

    <section className="ks-card ks-stat-section">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Schneller Verlauf</span><h2>Zuletzt durchgeführte Umfragen</h2><p>Diese erste Ansicht verwendet nur leichte Zähler; Detailstatistiken werden separat nachgeladen.</p></div></div>
      <div className="ks-stat-bars detailed">{conducted.map((round) => { const overview = byId.get(round.id); const counted = overview?.countedVotes || 0; return <a key={round.id} href={`/admin/release-voting/${round.id}/statistics`} className="ks-stat-bar-row"><div><strong>{round.title}</strong><small>{formatAdminDate(round.starts_at || round.created_at)}</small></div><div className="ks-stat-bar"><i style={{ width: `${Math.round((counted / maxVotes) * 100)}%` }} /><span>{counted}</span></div><small>{overview?.jurySubmitted || 0}/{overview?.jurorsCount || 0} Jury · {overview?.songsCount || 0} Songs</small></a>; })}{!conducted.length && <p>Noch keine durchgeführte Umfrage vorhanden.</p>}</div>
    </section>

    <HistoricalStatisticsLoader />
  </>;
}
