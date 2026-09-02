'use client';

import { useMemo, useState } from 'react';
import type { ReleaseWeekStatistics } from '@/lib/releaseStatisticsCore';

function dateLabel(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function decimal(value: number | null, suffix = '') {
  return value === null ? '—' : `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })}${suffix}`;
}

export default function HistoricalRoundsTable({ weeks }: { weeks: ReleaseWeekStatistics[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('de-DE');
    if (!needle) return weeks;
    return weeks.filter((week) => `${week.round.title} ${week.round.slug} ${week.round.starts_at || ''} ${dateLabel(week.round.starts_at || week.round.created_at)}`.toLocaleLowerCase('de-DE').includes(needle));
  }, [query, weeks]);

  return <section className="ks-card ks-stat-section" id="historical-rounds">
    <div className="ks-section-heading"><div><span className="ks-section-kicker">Archiv</span><h2>Alle Umfragen und Wochen</h2><p>Jede Zeile verwendet dasselbe Statistikmodell wie die jeweilige Einzelansicht.</p></div><label className="ks-history-search"><span>Umfragen durchsuchen</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Titel, Slug oder Datum …" /></label></div>
    <div className="ks-table-scroll"><table className="ks-table ks-history-table"><thead><tr><th>Umfrage</th><th>Woche</th><th>Songs</th><th>Publikum</th><th>Sieger</th><th>Abstand</th><th>Kurzinfo</th><th>Direkt öffnen</th></tr></thead><tbody>
      {filtered.map((week) => {
        const winners = week.overallRows.filter((row) => row.rank === 1);
        const highlight = week.highlights.find((item) => !['winner', 'last-place'].includes(item.key));
        return <tr key={week.round.id}>
          <td><a className="ks-history-title" href={`/admin/release-voting/${week.round.id}/statistics`}><strong>{week.round.title}</strong><small>{week.round.slug}</small></a></td>
          <td>{dateLabel(week.round.starts_at || week.round.created_at)}</td>
          <td>{week.songsCount}</td>
          <td><strong>{week.totalVotes}</strong><small>{week.countedVotes} gewertet</small></td>
          <td>{winners.length ? <><strong>{winners.map((row) => row.song.title).join(' / ')}</strong><small>{winners[0].song.artist}</small></> : '—'}</td>
          <td>{decimal(week.winnerGap)}<small>{decimal(week.winnerGapPercent, ' %')} relativ</small></td>
          <td>{highlight ? <><strong>{highlight.title}</strong><small>{highlight.value}</small></> : <span className="ks-status-badge muted">Noch keine Besonderheit</span>}</td>
          <td><div className="ks-history-row-actions"><a className="ks-button small primary" href={`/admin/release-voting/${week.round.id}/statistics`}>Statistiken</a><a className="ks-button small secondary" href={`/admin/release-voting/${week.round.id}/results`}>Ergebnisse</a></div></td>
        </tr>;
      })}
      {!filtered.length && <tr><td colSpan={8} className="ks-table-empty">Keine passende Umfrage gefunden.</td></tr>}
    </tbody></table></div>
  </section>;
}
