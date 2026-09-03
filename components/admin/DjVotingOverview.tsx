import type { AdminJuryRoundData } from '@/lib/juryVoting';
import type { AdminRoundDetailData } from '@/lib/releaseVoting';
import type { AdminDjParticipantRanking } from '@/lib/djVoting';
import type { HistoricalDjAggregate } from '@/lib/historicalJuryImport';
import { formatAdminDateTime } from '@/lib/adminUi';
import { StatCard } from './AdminUi';

const djStatusLabel: Record<AdminDjParticipantRanking['status'], string> = {
  counted: 'Gewertet', review: 'In Prüfung', excluded: 'Ausgeschlossen', unverified: 'Nicht bestätigt',
};

export default function DjVotingOverview({ data, historicalDj, historicalAggregates, participants }: { data: AdminRoundDetailData; historicalDj: AdminJuryRoundData; historicalAggregates: HistoricalDjAggregate[]; participants: AdminDjParticipantRanking[] }) {
  const { summary } = data;
  return <>
    <section className="ks-stats-grid dashboard">
      <StatCard label="DJ-Stimmen insgesamt" value={summary.totalVotes} />
      <StatCard label="Gewertet" value={summary.countedVotes} tone="success" />
      <StatCard label="Nicht bestätigt" value={summary.unverifiedVotes} tone="warning" />
      <StatCard label="Separate Excel-Rankings" value={historicalDj.jurors.filter((juror) => juror.submitted_at).length + historicalAggregates.length} tone="violet" />
    </section>

    <section className="ks-card">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Einzelansicht</span><h2>Abgegebene DJ-Rankings</h2><p>Jede über das DJ-Formular abgegebene Wertung bleibt als eigener Datensatz nachvollziehbar.</p></div></div>
      <div className="ks-jury-card-scroll">
        {participants.map((participant) => <article className="ks-jury-ranking-card" key={participant.voteId}><header><div className="ks-avatar">DJ</div><div><strong>{participant.name}</strong><small>{djStatusLabel[participant.status]} · {formatAdminDateTime(participant.verifiedAt || participant.createdAt)}</small></div></header>
          <ol>{participant.rows.map((row, index) => <li key={`${participant.voteId}-${row.song.id}`}><span className="rank">{index + 1}</span><span className="song"><strong>{row.song.title}</strong><small>{row.song.artist}</small></span><b>{row.points}</b></li>)}</ol>
        </article>)}
        {!participants.length && <div className="ks-empty-state"><strong>Noch keine DJ-Einzelwertungen</strong><p>Neue Abstimmungen über /dj-voting erscheinen nach Bestätigung hier.</p></div>}
      </div>
    </section>

    <section className="ks-card">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Eigene Kategorie</span><h2>DJ-Gesamtranking</h2><p>Diese Werte werden separat ausgewertet und fließen weder ins Publikumsvoting noch in die normale Jury-/Gesamtwertung ein.</p></div></div>
      <div className="ks-table-scroll"><table className="ks-table results"><thead><tr><th>Platz</th><th>Song</th><th>Künstler</th><th>Punkte gesamt</th><th>Gewählt</th><th>Ø</th></tr></thead><tbody>
        {summary.leaderboard.map((row, index) => <tr key={row.song.id}><td><span className="ks-rank-pill">{index + 1}</span></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist}</td><td>{row.total}</td><td>{row.count}</td><td>{row.avg.toFixed(1)}</td></tr>)}
        {!summary.leaderboard.length && <tr><td colSpan={6} className="ks-table-empty">Noch keine bestätigten DJ-Formularstimmen in dieser Umfrage.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="ks-card">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Historische Excel-Daten</span><h2>Separate DJ-Wertungen</h2><p>Importierte „DJs“-Spalten aus der Ranking-Tabelle erscheinen hier, nicht in den Jury-Ergebnissen.</p></div></div>
      <div className="ks-jury-card-scroll">
        {historicalAggregates.map((aggregate) => <article className="ks-jury-ranking-card ks-dj-aggregate-card" key={`${aggregate.sheet}-${aggregate.displayName}`}><header><div className="ks-avatar">DJ</div><div><strong>{aggregate.displayName}</strong><small>Excel-Originalwerte · {new Intl.DateTimeFormat('de-DE').format(new Date(`${aggregate.votingDate}T12:00:00Z`))}</small></div></header>
          <ol>{aggregate.rows.map((row) => <li key={`${aggregate.sheet}-${row.sourceSong}`}><span className="rank">{row.rank}</span><span className="song"><strong>{row.title}</strong><small>{row.artist}{!row.matched ? ' · Song-Zuordnung noch offen' : ''}</small></span><b>{new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(row.score)}</b></li>)}</ol>
          {aggregate.unmatchedSongs > 0 && <div className="ks-card-open-state warning">{aggregate.unmatchedSongs} Song-Zuordnungen sind im Importer noch zu bestätigen.</div>}
        </article>)}
        {historicalDj.jurors.map((juror) => <article className="ks-jury-ranking-card" key={juror.id}><header><div className="ks-avatar">DJ</div><div><strong>{juror.display_name}</strong><small>{juror.submitted_at ? `Erfasst · ${formatAdminDateTime(juror.vote_updated_at || juror.submitted_at)}` : 'Noch keine Wertung'}</small></div></header>
          {juror.items.length ? <ol>{juror.items.map((item, index) => { const song = data.songs.find((entry) => entry.id === item.song_id); return <li key={`${juror.id}-${item.song_id}`}><span className="rank">{index + 1}</span><span className="song"><strong>{song?.title || 'Unbekannter Song'}</strong><small>{song?.artist || ''}</small></span><b>{item.points}</b></li>; })}</ol> : <div className="ks-card-open-state">Keine abgeschlossene Rangliste vorhanden.</div>}
        </article>)}
        {!historicalDj.jurors.length && !historicalAggregates.length && <div className="ks-empty-state"><strong>Keine historische DJ-Rangliste</strong><p>Für diese Woche wurde keine separate „DJs“-Spalte gefunden oder importiert.</p></div>}
      </div>
    </section>
  </>;
}
