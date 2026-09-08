import type { PodcastReportData, PodcastReportJuror } from '@/lib/podcastReport';
import styles from '@/app/admin/release-voting/[roundId]/results/results.module.css';

function avg(value: number | null) {
  return value === null ? '—' : value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function rank(value: number | null) {
  return value === null ? '—' : `#${value}`;
}

function pct(value: number | null) {
  return value === null ? '—' : `${value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function voteAt(juror: PodcastReportJuror, place: number) {
  return juror.rows.find((row) => row.rank === place) || null;
}

function shortName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return value;
  return `${parts[0]} ${parts.slice(1).map((part) => `${part[0]}.`).join(' ')}`;
}

export default function PodcastReport({ data }: { data: PodcastReportData }) {
  const density = data.overallRows.length > 26
    ? styles.podcastUltraDense
    : data.overallRows.length > 20
      ? styles.podcastVeryDense
      : data.overallRows.length > 15
        ? styles.podcastDense
        : '';

  const voteColumns = [
    ...data.jurors.map((juror) => ({ id: juror.id, label: juror.name, juror })),
    { id: 'audience', label: 'Publikum', juror: null },
  ];

  return <div className={`${styles.podcastReport} ${density}`}>
    <section className={styles.podcastPaper} aria-label="Sendungsausdruck Seite 1">
      <header className={styles.podcastPaperHeader}>
        <div>
          <span>KNALLHART SERVIERT · RELEASE CHECK</span>
          <h2>Sendungsausdruck · Seite 1/2</h2>
          <p>{data.title}{data.period ? ` · ${data.period}` : ''}</p>
        </div>
        <div className={styles.podcastHeaderMeta}>
          <b>{data.summary.songs}</b><small>Songs</small>
          <b>{data.summary.countedAudienceVotes}</b><small>Publikum gewertet</small>
          <b>{data.summary.submittedJurors}/{data.summary.activeJurors}</b><small>Jury abgegeben</small>
        </div>
      </header>

      <div className={styles.podcastSummaryGrid}>
        <article className={styles.podcastSummaryOverall}>
          <small>GESAMT</small>
          <strong>{data.quick.overallWinner}</strong>
          <span>{data.quick.overallWinnerDetail}{data.summary.winnerGap === null ? '' : ` · Abstand P1–P2: ${data.summary.winnerGap} Pkt.`}</span>
        </article>
        <article className={styles.podcastSummaryJury}>
          <small>JURY</small>
          <strong>{data.quick.juryWinner}</strong>
          <span>{data.quick.juryWinnerDetail} · {data.summary.submittedJurors}/{data.summary.activeJurors} abgegeben</span>
        </article>
        <article className={styles.podcastSummaryAudience}>
          <small>PUBLIKUM</small>
          <strong>{data.quick.audienceWinner}</strong>
          <span>{data.quick.audienceWinnerDetail} · {data.summary.countedAudienceVotes} gewertet</span>
        </article>
        <article className={styles.podcastSummaryZonk}>
          <small>ZONK / ABWEICHUNG</small>
          <strong>{data.quick.zonkWinner}</strong>
          <span>{data.quick.zonkWinnerDetail} · Größte Abweichung: {data.quick.strongestSplit}</span>
        </article>
      </div>

      <div className={styles.podcastBlockHeading}>
        <div><b>1</b><span><strong>Alle Songs auf einen Blick</strong><small>Gesamt-, Jury- und Publikumswerte inklusive jeder einzelnen Jurystimme.</small></span></div>
        <p><b>Ø Jury</b> = alle abgegebenen Jurystimmen inkl. 0 für nicht platzierte Songs. <b>Ø Publikum</b> = alle gewerteten Publikumsstimmen inkl. 0.</p>
      </div>

      <div className={styles.podcastMatrixWrap}>
        <table className={styles.podcastMasterTable}>
          <thead>
            <tr>
              <th rowSpan={2}>G</th><th rowSpan={2}>J</th><th rowSpan={2}>P</th><th rowSpan={2}>Song / Künstler</th>
              <th colSpan={Math.max(1, data.jurors.length) + 2}>Jury</th>
              <th colSpan={3}>Publikum</th>
              <th colSpan={2}>Gesamt</th>
            </tr>
            <tr>
              {data.jurors.length ? data.jurors.map((juror) => <th key={juror.id}>{shortName(juror.name)}</th>) : <th>—</th>}
              <th>Σ</th><th>Ø</th>
              <th>12–1</th><th>Roh</th><th>Ø</th>
              <th>Σ</th><th>Ø</th>
            </tr>
          </thead>
          <tbody>
            {data.overallRows.map((row) => <tr key={`${row.title}-${row.artist}`}>
              <td><b>{rank(row.rank)}</b></td>
              <td>{rank(row.juryRank)}</td>
              <td>{rank(row.audienceRank)}</td>
              <td className={styles.podcastSongCell}><strong>{row.title}</strong><small>{row.artist}</small></td>
              {row.jurorPoints.length ? row.jurorPoints.map((entry) => <td key={entry.jurorId}>{entry.points === null ? '—' : entry.points}</td>) : <td>—</td>}
              <td><b>{row.juryPoints}</b></td><td><b>{avg(row.juryAverage)}</b></td>
              <td>{row.audiencePoints}</td><td>{row.audienceRawPoints}</td><td><b>{avg(row.audienceAverage)}</b></td>
              <td><b>{row.total}</b></td><td><b>{avg(row.overallAverage)}</b></td>
            </tr>)}
          </tbody>
        </table>
      </div>

      <footer className={styles.podcastPaperFooter}>
        <span><b>G/J/P</b> = Gesamt-/Jury-/Publikumsplatz.</span>
        <span><b>Publikum 12–1</b> = aggregierte Publikumsstimme für die Gesamtwertung.</span>
        <span><b>Roh</b> = Summe der Punkte aller einzelnen Publikumsvotings.</span>
      </footer>
    </section>

    <section className={styles.podcastPaper} aria-label="Sendungsausdruck Seite 2">
      <header className={`${styles.podcastPaperHeader} ${styles.podcastPaperHeaderSmall}`}>
        <div>
          <span>KNALLHART SERVIERT · RELEASE CHECK</span>
          <h2>Einzelstimmen & Publikum · Seite 2/2</h2>
          <p>{data.title}{data.period ? ` · ${data.period}` : ''}</p>
        </div>
        <div className={styles.podcastHeaderCallout}><b>{data.quick.strongestSplit}</b><small>{data.quick.strongestSplitDetail}</small></div>
      </header>

      <div className={styles.podcastBlockHeading}>
        <div><b>2</b><span><strong>Einzelne Jury-Wertungen + Publikum</strong><small>Die Top 12 jeder einzelnen Wertungsstimme nebeneinander – ideal zum direkten Vergleichen im Podcast.</small></span></div>
      </div>

      <div className={styles.podcastVotesWrap}>
        <table className={styles.podcastVotesTable}>
          <thead><tr><th>Pl.</th>{voteColumns.map((column) => <th key={column.id}>{shortName(column.label)}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((place) => <tr key={place}>
              <td><b>#{place}</b><small>{13 - place} P.</small></td>
              {data.jurors.map((juror) => {
                const vote = voteAt(juror, place);
                return <td key={juror.id} className={styles.podcastVoteCell}>{juror.submitted && vote ? <><strong>{vote.title}</strong><small>{vote.artist}</small></> : <span>—</span>}</td>;
              })}
              <td className={`${styles.podcastVoteCell} ${styles.podcastVoteAudience}`}>{data.audienceCard.rows[place - 1] ? <><strong>{data.audienceCard.rows[place - 1].title}</strong><small>{data.audienceCard.rows[place - 1].artist}</small></> : <span>—</span>}</td>
            </tr>)}
            <tr className={styles.podcastZonkRow}>
              <td><b>ZONK</b></td>
              {data.jurors.map((juror) => <td key={juror.id}>{juror.zonk || '—'}</td>)}
              <td>{data.audienceCard.zonk || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.podcastPage2Bottom}>
        <section className={styles.podcastAudiencePanel}>
          <div className={styles.podcastMiniHeading}><strong>Publikum kompakt</strong><span>Rohpunkte, Durchschnitt und Reichweite der Publikumswertung</span></div>
          <table className={styles.podcastAudienceTable}>
            <thead><tr><th>Pl.</th><th>Song / Künstler</th><th>Roh</th><th>Ø Publ.</th><th>Gewählt</th><th>Anteil</th><th>12–1</th></tr></thead>
            <tbody>{data.audienceRows.map((row) => <tr key={`aud-${row.rank}`}>
              <td><b>#{row.rank}</b></td><td className={styles.podcastSongCell}><strong>{row.title}</strong><small>{row.artist}</small></td><td>{row.total}</td><td><b>{avg(row.average)}</b></td><td>{row.mentions}</td><td>{pct(row.share)}</td><td><b>{row.audiencePoints}</b></td>
            </tr>)}</tbody>
          </table>
        </section>

        <aside className={styles.podcastTalkPanel}>
          <div className={styles.podcastMiniHeading}><strong>Gesprächsanker</strong><span>Was sich fürs Ansprechen in der Sendung besonders lohnt</span></div>
          <dl>
            <div><dt>Gesamtsieger</dt><dd>{data.quick.overallWinner}<small>{data.quick.overallWinnerDetail}</small></dd></div>
            <div><dt>Jury-Sieger</dt><dd>{data.quick.juryWinner}<small>{data.quick.juryWinnerDetail}</small></dd></div>
            <div><dt>Publikumssieger</dt><dd>{data.quick.audienceWinner}<small>{data.quick.audienceWinnerDetail}</small></dd></div>
            <div><dt>Größte Abweichung</dt><dd>{data.quick.strongestSplit}<small>{data.quick.strongestSplitDetail}</small></dd></div>
          </dl>
          <div className={styles.podcastZonkCompact}>
            <strong>ZONK gesamt</strong>
            {data.zonkRows.slice(0, 5).map((row) => <div key={`z-${row.rank}-${row.title}`}><b>#{row.rank}</b><span>{row.title}<small>{row.artist}</small></span><em>P {row.audience} · J {row.jury} · Σ {row.total}</em></div>)}
            {!data.zonkRows.length && <p>Noch keine ZONK-Stimmen.</p>}
          </div>
        </aside>
      </div>

      <footer className={styles.podcastPaperFooter}>
        <span><b>Jury:</b> jede abgegebene Jury-Stimme vergibt 12 bis 1 Punkte.</span>
        <span><b>Publikum:</b> Ø basiert auf allen gewerteten Einzelstimmen; die Top 12 wird zusätzlich als eine 12–1-Stimme in der Gesamtwertung verwendet.</span>
      </footer>
    </section>
  </div>;
}
