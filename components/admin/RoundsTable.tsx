'use client';

import { useMemo, useState } from 'react';
import type { Round } from '@/lib/releaseVotingShared';
import type { AdminRoundOverview } from '@/lib/adminOverview';
import { adminRoundStatusLabel, formatRoundPeriod, getAdminRoundStatus, type AdminRoundStatus } from '@/lib/adminUi';
import { StatusBadge } from './AdminUi';

type Filter = 'all' | AdminRoundStatus;
const PAGE_SIZE = 8;

export default function RoundsTable({ rounds, overviews }: { rounds: Round[]; overviews: AdminRoundOverview[] }) {
  const [filter, setFilter] = useState<Filter>('all'); const [query, setQuery] = useState(''); const [page, setPage] = useState(1);
  const overviewById = useMemo(() => new Map(overviews.map((item) => [item.roundId, item])), [overviews]);
  const filtered = useMemo(() => { const normalized = query.trim().toLocaleLowerCase('de'); return rounds.filter((round) => { const status = getAdminRoundStatus(round); return (filter === 'all' || filter === status) && (!normalized || `${round.title} ${round.slug}`.toLocaleLowerCase('de').includes(normalized)); }); }, [rounds, filter, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)); const safePage = Math.min(page, pages); const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  function changeFilter(next: Filter) { setFilter(next); setPage(1); }
  return (
    <section className="ks-card ks-rounds-card">
      <div className="ks-table-toolbar"><div className="ks-filter-tabs">{([['all', 'Alle'], ['active', 'Aktiv'], ['planned', 'Geplant'], ['ended', 'Abgeschlossen']] as Array<[Filter, string]>).map(([key, label]) => <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => changeFilter(key)}>{label}</button>)}</div><label className="ks-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Umfragen suchen…" aria-label="Umfragen suchen" /></label></div>
      <div className="ks-table-scroll"><table className="ks-table rounds"><thead><tr><th>Umfrage</th><th>Zeitraum</th><th>Status</th><th>Jury</th><th>Publikum</th><th>Songs</th><th>Stimmen</th><th></th></tr></thead><tbody>
        {visible.map((round) => { const overview = overviewById.get(round.id); const status = getAdminRoundStatus(round); return <tr key={round.id}><td><strong>{round.title}</strong><small>{round.slug}</small></td><td>{formatRoundPeriod(round)}</td><td><StatusBadge status={status}>{adminRoundStatusLabel(status)}</StatusBadge>{round.is_current && <small>Aktuelle Haupt-Umfrage</small>}</td><td><strong>{overview?.jurySubmitted || 0}/{overview?.jurorsCount || 0}</strong><div className="ks-progress slim"><i style={{ width: `${overview?.jurorsCount ? Math.round((overview.jurySubmitted / overview.jurorsCount) * 100) : 0}%` }} /></div></td><td>{overview?.reviewVotes ? <span className="ks-cell-warning">{overview.reviewVotes} prüfen</span> : <span className="ks-cell-success">Bereit</span>}</td><td>{overview?.songsCount || 0}</td><td><strong>{overview?.totalVotes || 0}</strong><small>{overview?.countedVotes || 0} gewertet</small></td><td><a className="ks-button small secondary" href={`/admin/release-voting/${round.id}`}>Öffnen</a></td></tr>; })}
        {!visible.length && <tr><td colSpan={8} className="ks-table-empty">Keine passenden Umfragen gefunden.</td></tr>}
      </tbody></table></div>
      <div className="ks-pagination"><span>{filtered.length ? `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} von ${filtered.length}` : '0 Umfragen'}</span><div><button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>←</button>{Array.from({ length: pages }, (_, index) => index + 1).slice(Math.max(0, safePage - 3), safePage + 2).map((number) => <button key={number} type="button" className={number === safePage ? 'active' : ''} onClick={() => setPage(number)}>{number}</button>)}<button type="button" disabled={safePage >= pages} onClick={() => setPage(safePage + 1)}>→</button></div></div>
    </section>
  );
}
