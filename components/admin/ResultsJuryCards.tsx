import type { AdminRoundSummary, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { buildCombinedResults } from '@/lib/combinedVotingResults';
import { formatAdminDateTime } from '@/lib/adminUi';

export default function ResultsJuryCards({ songs, summary, juryData }: { songs: Song[]; summary: AdminRoundSummary; juryData: AdminJuryRoundData }) {
  const results = buildCombinedResults(songs, summary.leaderboard, summary.countedVotes, juryData);
  const cards = [
    ...results.jurorRankings.map((ranking) => ({ id: ranking.juror.id, name: ranking.juror.display_name, submittedAt: ranking.juror.vote_updated_at || ranking.juror.submitted_at, rows: ranking.rows, open: !ranking.juror.submitted_at })),
    { id: 'audience', name: 'Publikum Top 12', submittedAt: null, rows: results.audienceResults.map((row) => ({ song: row.song, points: row.audiencePoints, rank: row.rank })), open: summary.countedVotes <= 0 },
  ];
  return <section className="ks-card"><div className="ks-section-heading"><div><span className="ks-section-kicker">Jury-Voting</span><h2>Einzelne Wertungen</h2><p>Jede persönliche Jury-Wertung und das Publikum als gleichwertige 12-bis-1-Punkte-Stimme.</p></div></div><div className="ks-jury-card-scroll">{cards.map((card) => <article className="ks-jury-ranking-card" key={card.id}><header><div className="ks-avatar">{card.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><strong>{card.name}</strong><small>{card.id === 'audience' ? `${summary.countedVotes} gewertete Stimmen` : card.open ? 'Noch offen' : `Abgegeben · ${formatAdminDateTime(card.submittedAt)}`}</small></div></header>{card.open ? <div className="ks-card-open-state">Noch keine abgeschlossene Wertung.</div> : <ol>{card.rows.map((row) => <li key={row.song.id}><span className="rank">{row.rank}</span><span className="song"><strong>{row.song.title}</strong><small>{row.song.artist}</small></span><b>{row.points}</b></li>)}</ol>}</article>)}</div></section>;
}
