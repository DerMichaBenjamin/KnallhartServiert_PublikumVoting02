import type { PodcastReportData } from '@/lib/podcastReport';
import styles from '@/app/admin/release-voting/[roundId]/results/results.module.css';

function avg(value: number | null) {
  return value === null ? '—' : value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function rank(value: number | null) {
  return value === null ? '—' : `#${value}`;
}

function splitLabel(value: number | null) {
  if (value === null) return '—';
  if (value === 0) return 'gleich';
  return value > 0 ? `Publikum +${value}` : `Jury +${Math.abs(value)}`;
}

export default function PodcastReport({ data }: { data: PodcastReportData }) {
  return <div className={styles.podcastReport}>
    <section className={`${styles.podcastSection} ${styles.podcastNoBreak}`}>
      <div className={styles.podcastTitleBlock}>
        <div><span>KNALLHART SERVIERT · RELEASE CHECK</span><h2>Sendungsausdruck</h2><p>{data.title}{data.period ? ` · ${data.period}` : ''}</p></div>
        <div className={styles.podcastMeta}><strong>{data.summary.songs}</strong><span>Songs</span><strong>{data.summary.countedAudienceVotes}</strong><span>Publikum gewertet</span><strong>{data.summary.submittedJurors}/{data.summary.activeJurors}</strong><span>Jury abgegeben</span></div>
      </div>
      <div className={styles.podcastQuickGrid}>
        <article><small>Gesamtsieger</small><strong>{data.quick.overallWinner}</strong><span>{data.quick.overallWinnerDetail}</span></article>
        <article><small>Jury-Sieger</small><strong>{data.quick.juryWinner}</strong><span>{data.quick.juryWinnerDetail}</span></article>
        <article><small>Publikums-Sieger</small><strong>{data.quick.audienceWinner}</strong><span>{data.quick.audienceWinnerDetail}</span></article>
        <article><small>ZONK gesamt</small><strong>{data.quick.zonkWinner}</strong><span>{data.quick.zonkWinnerDetail}</span></article>
        <article><small>Größte Jury/Publikum-Abweichung</small><strong>{data.quick.strongestSplit}</strong><span>{data.quick.strongestSplitDetail}</span></article>
        <article><small>Abstand Platz 1–2</small><strong>{data.summary.winnerGap === null ? '—' : `${data.summary.winnerGap} Pkt.`}</strong><span>{data.summary.totalAudienceVotes} Publikumsstimmen insgesamt</span></article>
      </div>
    </section>

    <section className={`${styles.podcastSection} ${styles.podcastPageBreak}`}>
      <header className={styles.podcastSectionHeading}><span>01</span><div><h2>Gesamtwertung Jury + Publikum</h2><p>Die zentrale Tabelle für die Sendung: Einzelpunkte jedes Jurors, Jury-Summe und -Durchschnitt, Publikum sowie Gesamtwertung.</p></div></header>
      <div className="ks-table-scroll">
        <table className={`ks-table results overall ${styles.podcastDenseTable}`}>
          <thead><tr><th>Platz</th><th>Song / Künstler</th>{data.jurors.map((juror) => <th key={juror.id}>{juror.name}</th>)}<th>Jury Σ</th><th>Ø Jury</th><th>Publ.</th><th>Gesamt</th><th>Ø Ges.</th></tr></thead>
          <tbody>{data.overallRows.map((row) => <tr key={`${row.title}-${row.artist}`}><td><strong>{rank(row.rank)}</strong></td><td><strong>{row.title}</strong><small>{row.artist}</small></td>{row.jurorPoints.map((entry) => <td key={entry.jurorId}>{entry.points === null ? '—' : entry.points}</td>)}<td><strong>{row.juryPoints}</strong></td><td>{avg(row.juryAverage)}</td><td>{row.audiencePoints}</td><td><strong>{row.total}</strong></td><td><strong>{avg(row.overallAverage)}</strong></td></tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className={`${styles.podcastSection} ${styles.podcastPageBreak}`}>
      <header className={styles.podcastSectionHeading}><span>02</span><div><h2>Einzelne Jury-Wertungen</h2><p>Die komplette Top 12 jedes Jurymitglieds. Das Publikum steht als virtuelle 12–1-Stimme daneben. Der jeweilige ZONK steht direkt unter der Wertung.</p></div></header>
      <div className={styles.podcastJuryGrid}>
        {data.jurors.map((juror) => <article className={styles.podcastJuryCard} key={juror.id}><header><strong>{juror.name}</strong><span>{juror.submitted ? 'abgegeben' : 'noch offen'}</span></header>{juror.submitted ? <ol>{juror.rows.map((row) => <li key={`${juror.id}-${row.rank}`}><b>#{row.rank}</b><span><strong>{row.title}</strong><small>{row.artist}</small></span><em>{row.points} Pkt.</em></li>)}</ol> : <p className={styles.podcastEmpty}>Noch keine Wertung.</p>}<footer><b>ZONK:</b> {juror.zonk || 'Kein ZONK gewählt'}</footer></article>)}
        <article className={`${styles.podcastJuryCard} ${styles.podcastAudienceCard}`}><header><strong>Publikum · virtuelle 12–1-Stimme</strong><span>{data.summary.countedAudienceVotes} gewertet</span></header><ol>{data.audienceCard.rows.map((row) => <li key={`aud-${row.rank}`}><b>#{row.rank}</b><span><strong>{row.title}</strong><small>{row.artist}</small></span><em>{row.points} Pkt.</em></li>)}</ol><footer><b>Publikums-ZONK:</b> {data.audienceCard.zonk || 'Noch kein ZONK'}</footer></article>
      </div>
    </section>

    <section className={`${styles.podcastSection} ${styles.podcastPageBreak}`}>
      <header className={styles.podcastSectionHeading}><span>03</span><div><h2>Song-Bewertungen im Vergleich</h2><p>Die schnellste Gesprächsgrundlage pro Song: Platzierungen und Durchschnittswerte von Jury, Publikum und Gesamtwertung.</p></div></header>
      <div className="ks-table-scroll">
        <table className={`ks-table results ${styles.podcastDenseTable}`}>
          <thead><tr><th>Ges.</th><th>Song / Künstler</th><th>Jury-Pl.</th><th>Publ.-Pl.</th><th>Ø Jury</th><th>Ø Publikum</th><th>Ø Gesamt</th><th>Publ. gewählt</th><th>Abweichung</th><th>Polarisierung</th></tr></thead>
          <tbody>{data.songRatingRows.map((row) => <tr key={`rating-${row.title}-${row.artist}`}><td><strong>{rank(row.rank)}</strong></td><td><strong>{row.title}</strong><small>{row.artist}</small></td><td>{rank(row.juryRank)}</td><td>{rank(row.audienceRank)}</td><td><strong>{avg(row.juryAverage)}</strong></td><td><strong>{avg(row.audienceAverage)}</strong></td><td><strong>{avg(row.overallAverage)}</strong></td><td>{row.audienceMentions}</td><td>{splitLabel(row.rankDifference)}</td><td>{row.polarizationIndex === null ? '—' : `${row.polarizationIndex}/100`}</td></tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className={`${styles.podcastSection} ${styles.podcastPageBreak}`}>
      <header className={styles.podcastSectionHeading}><span>04</span><div><h2>Publikumsergebnis</h2><p>Die offizielle Publikums-Top-12 inklusive Rohpunkten, Ø Publikum, Nennungen und daraus abgeleiteter 12–1-Stimme.</p></div></header>
      <div className="ks-table-scroll">
        <table className={`ks-table results ${styles.podcastDenseTable}`}>
          <thead><tr><th>Platz</th><th>Song / Künstler</th><th>Publikumspunkte</th><th>Ø Publikum</th><th>Gewählt</th><th>Anteil</th><th>12–1</th></tr></thead>
          <tbody>{data.audienceRows.map((row) => <tr key={`audience-${row.rank}`}><td><strong>#{row.rank}</strong></td><td><strong>{row.title}</strong><small>{row.artist}</small></td><td>{row.total}</td><td><strong>{avg(row.average)}</strong></td><td>{row.mentions}</td><td>{row.share === null ? '—' : `${row.share.toFixed(1)} %`}</td><td><strong>{row.audiencePoints}</strong></td></tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className={`${styles.podcastSection} ${styles.podcastPageBreak}`}>
      <header className={styles.podcastSectionHeading}><span>05</span><div><h2>ZONK-Auswertung</h2><p>Publikum und Jury getrennt und zusammen. Die ZONK-Stimmen verändern die normale Punktewertung nicht.</p></div></header>
      <div className="ks-table-scroll"><table className={`ks-table results ${styles.podcastDenseTable}`}><thead><tr><th>Platz</th><th>Song / Künstler</th><th>Publikum</th><th>Jury</th><th>Gesamt</th></tr></thead><tbody>{data.zonkRows.map((row) => <tr key={`zonk-${row.rank}-${row.title}`}><td><strong>#{row.rank}</strong></td><td><strong>{row.title}</strong><small>{row.artist}</small></td><td>{row.audience}</td><td>{row.jury}</td><td><strong>{row.total}</strong></td></tr>)}{!data.zonkRows.length && <tr><td colSpan={5}>Noch keine ZONK-Stimmen vorhanden.</td></tr>}</tbody></table></div>
    </section>

    <section className={`${styles.podcastSection} ${styles.podcastNotes}`}>
      <header className={styles.podcastSectionHeading}><span>06</span><div><h2>Sendungsnotizen</h2><p>Freier Platz für spontane Punkte während der Aufzeichnung.</p></div></header>
      {Array.from({ length: 8 }, (_, index) => <div key={index} />)}
    </section>
  </div>;
}
