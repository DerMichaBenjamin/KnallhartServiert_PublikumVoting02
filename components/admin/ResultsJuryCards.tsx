import type { AdminRoundSummary, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { buildCombinedResults } from '@/lib/combinedVotingResults';
import { buildJuryZonkResults, buildPublicZonkResults } from '@/lib/zonkResults';
import { formatAdminDateTime } from '@/lib/adminUi';

function songLabel(song: Song | null | undefined) {
  return song ? `${song.title} — ${song.artist}` : 'Kein ZONK gewählt';
}

export default function ResultsJuryCards({ songs, summary, juryData }: { songs: Song[]; summary: AdminRoundSummary; juryData: AdminJuryRoundData }) {
  const results = buildCombinedResults(songs, summary.leaderboard, summary.countedVotes, juryData);
  const songById = new Map(songs.map((song) => [song.id, song]));
  const publicZonk = buildPublicZonkResults(summary.zonk);
  const audienceTopZonkCount = publicZonk[0]?.count || 0;
  const audienceTopZonks = publicZonk.filter((row) => row.count === audienceTopZonkCount);
  const juryZonkRows = buildJuryZonkResults(songs, juryData);
  const juryZonkVotes = juryZonkRows.reduce((sum, row) => sum + row.count, 0);

  const cards = [
    ...results.jurorRankings.map((ranking) => ({
      id: ranking.juror.id,
      name: ranking.juror.display_name,
      submittedAt: ranking.juror.vote_updated_at || ranking.juror.submitted_at,
      rows: ranking.rows,
      open: !ranking.juror.submitted_at,
      zonkText: ranking.juror.submitted_at
        ? songLabel(ranking.juror.zonk_song_id ? songById.get(ranking.juror.zonk_song_id) : null)
        : 'Noch offen',
      zonkLabel: 'ZONK',
    })),
    {
      id: 'audience',
      name: 'Publikum Top 12',
      submittedAt: null,
      rows: results.audienceResults.map((row) => ({ song: row.song, points: row.audiencePoints, rank: row.rank })),
      open: summary.countedVotes <= 0,
      zonkText: audienceTopZonks.length
        ? audienceTopZonks.map((row) => `${row.song.title} — ${row.song.artist} (${row.count})`).join(' / ')
        : 'Noch kein Publikums-ZONK',
      zonkLabel: 'Publikums-ZONK',
    },
  ];

  return <>
    <section className="ks-card">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Jury-Voting</span><h2>Einzelne Wertungen</h2><p>Jede persönliche Jury-Wertung plus das Publikum als gleichwertige 12-bis-1-Punkte-Stimme. Unter jeder Wertung steht zusätzlich der gewählte ZONK.</p></div></div>
      <div className="ks-jury-card-scroll">
        {cards.map((card) => <article className="ks-jury-ranking-card" key={card.id}>
          <header><div className="ks-avatar">{card.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><strong>{card.name}</strong><small>{card.id === 'audience' ? `${summary.countedVotes} gewertete Stimmen` : card.open ? 'Noch offen' : `Abgegeben · ${formatAdminDateTime(card.submittedAt)}`}</small></div></header>
          {card.open ? <div className="ks-card-open-state">Noch keine abgeschlossene Wertung.</div> : <ol>{card.rows.map((row) => <li key={row.song.id}><span className="rank">#{row.rank}</span><span className="song"><strong>{row.song.title}</strong><small>{row.song.artist}</small></span><b>{row.points} Pkt.</b></li>)}</ol>}
          <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}><strong>{card.zonkLabel}:</strong> {card.zonkText}</div>
        </article>)}
      </div>
    </section>

    <section className="ks-card">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Jury-ZONK</span><h2>ZONK-Auswertung der Jury</h2><p>{juryZonkVotes ? `${juryZonkVotes} Jury-ZONK-Stimmen wurden abgegeben.` : 'Noch keine Jury-ZONK-Stimme vorhanden.'}</p></div></div>
      <div className="ks-table-scroll"><table className="ks-table results"><thead><tr><th>Platz</th><th>Song</th><th>Künstler</th><th>ZONK-Stimmen Jury</th></tr></thead><tbody>{juryZonkRows.map((row) => <tr key={row.song.id}><td><span className="ks-rank-pill">#{row.rank}</span></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist}</td><td><strong>{row.count}</strong></td></tr>)}{!juryZonkRows.length && <tr><td colSpan={4} className="ks-table-empty">Noch keine Jury-ZONK-Stimmen vorhanden.</td></tr>}</tbody></table></div>
    </section>
  </>;
}
