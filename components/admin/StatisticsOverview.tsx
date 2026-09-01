import type { Round } from '@/lib/releaseVotingShared';
import type { AdminRoundOverview } from '@/lib/adminOverview';
import { formatAdminDate } from '@/lib/adminUi';

export default function StatisticsOverview({ rounds, overviews }: { rounds: Round[]; overviews: AdminRoundOverview[] }) {
  const overviewById = new Map(overviews.map((item) => [item.roundId, item]));
  const maxVotes = Math.max(1, ...overviews.map((item) => item.totalVotes));
  return <section className="ks-card"><div className="ks-section-heading"><div><span className="ks-section-kicker">Verlauf</span><h2>Publikumsstimmen pro Umfrage</h2></div></div><div className="ks-stat-bars">{rounds.map((round) => { const stats = overviewById.get(round.id); const total = stats?.totalVotes || 0; const counted = stats?.countedVotes || 0; return <a key={round.id} href={`/admin/release-voting/${round.id}/results`} className="ks-stat-bar-row"><div><strong>{round.title}</strong><small>{formatAdminDate(round.starts_at || round.created_at)}</small></div><div className="ks-stat-bar"><i style={{ width: `${Math.round((total / maxVotes) * 100)}%` }} /><span>{total}</span></div><small>{counted} gewertet</small></a>; })}{!rounds.length && <p>Noch keine Umfragen vorhanden.</p>}</div></section>;
}
