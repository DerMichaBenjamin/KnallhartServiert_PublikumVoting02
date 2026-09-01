export default function VotingCheckCard({ roundId, reviewVotes, duplicateGroups, openJurors }: { roundId: string; reviewVotes: number; duplicateGroups: number; openJurors: number }) {
  const total = reviewVotes + duplicateGroups + openJurors;
  const target = reviewVotes > 0
    ? `/admin/release-voting/${roundId}/security`
    : duplicateGroups > 0
      ? `/admin/release-voting/${roundId}#duplicate-check`
      : `/admin/release-voting/${roundId}#jury`;
  return (
    <section className={`ks-voting-check ${total ? 'warning' : 'success'}`} id="voting-check">
      <div className="ks-voting-check-icon" aria-hidden="true">{total ? '!' : '✓'}</div>
      <div className="ks-voting-check-copy">
        <span className="ks-section-kicker">Voting-Prüfung</span>
        <h2>{total ? `${total} ${total === 1 ? 'Punkt muss' : 'Punkte müssen'} geprüft werden` : 'Keine offenen Voting-Probleme'}</h2>
        {total ? <ul>{reviewVotes > 0 && <li>Auffällige Stimmen: <b>{reviewVotes}</b></li>}{duplicateGroups > 0 && <li>Mögliche Doppler: <b>{duplicateGroups}</b></li>}{openJurors > 0 && <li>Jury noch offen: <b>{openJurors}</b></li>}</ul> : <p>Publikumsstimmen, Songliste und Jury-Fortschritt zeigen aktuell keine offenen Punkte.</p>}
      </div>
      {total > 0 && <a className="ks-button warning" href={target}>Jetzt prüfen</a>}
    </section>
  );
}
