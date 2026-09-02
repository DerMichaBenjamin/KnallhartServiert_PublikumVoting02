'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Round } from '@/lib/releaseVotingShared';
import type { AdminRoundOverview, AdminRoundsFilter } from '@/lib/adminOverview';
import { adminRoundStatusLabel, formatRoundPeriod, getAdminRoundStatus } from '@/lib/adminUi';
import { StatusBadge } from './AdminUi';

type Props = {
  rounds: Round[];
  overviews: AdminRoundOverview[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  filter: AdminRoundsFilter;
};

export default function RoundsTable({ rounds, overviews, total, page, pageSize, query, filter }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(query);
  const overviewById = new Map(overviews.map((item) => [item.roundId, item]));
  const pages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => setSearch(query), [query]);

  function href(next: { page?: number; query?: string; filter?: AdminRoundsFilter }) {
    const params = new URLSearchParams();
    const nextQuery = typeof next.query === 'string' ? next.query : query;
    const nextFilter = next.filter || filter;
    const nextPage = next.page || 1;
    if (nextQuery) params.set('q', nextQuery);
    if (nextFilter !== 'all') params.set('status', nextFilter);
    if (nextPage > 1) params.set('page', String(nextPage));
    const suffix = params.toString();
    return `/admin/rounds${suffix ? `?${suffix}` : ''}`;
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    router.push(href({ query: search.trim(), page: 1 }));
  }

  return (
    <section className="ks-card ks-rounds-card">
      <div className="ks-table-toolbar">
        <div className="ks-filter-tabs" aria-label="Umfragen filtern">
          {([['all', 'Alle'], ['active', 'Aktiv'], ['planned', 'Geplant'], ['ended', 'Abgeschlossen']] as Array<[AdminRoundsFilter, string]>).map(([key, label]) =>
            <a key={key} className={filter === key ? 'active' : ''} href={href({ filter: key, page: 1 })}>{label}</a>
          )}
        </div>
        <form className="ks-search" onSubmit={submitSearch}>
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Umfragen suchen…" aria-label="Umfragen suchen" />
          <button type="submit">Suchen</button>
        </form>
      </div>
      <div className="ks-table-scroll">
        <table className="ks-table rounds">
          <thead><tr><th>Öffnen / Umfrage</th><th>Zeitraum</th><th>Status</th><th>Jury</th><th>Publikum</th><th>Songs</th><th>Stimmen</th></tr></thead>
          <tbody>
            {rounds.map((round) => {
              const overview = overviewById.get(round.id);
              const status = getAdminRoundStatus(round);
              return <tr key={round.id}>
                <td><div className="ks-round-primary"><a className="ks-button small primary" href={`/admin/release-voting/${round.id}`}>Öffnen</a><div><a className="ks-round-title" href={`/admin/release-voting/${round.id}`}>{round.title}</a><small>{round.slug}</small></div></div></td>
                <td>{formatRoundPeriod(round)}</td>
                <td><StatusBadge status={status}>{adminRoundStatusLabel(status)}</StatusBadge>{round.is_current && <small>Aktuelle Haupt-Umfrage</small>}</td>
                <td><strong>{overview?.jurySubmitted || 0}/{overview?.jurorsCount || 0}</strong><div className="ks-progress slim"><i style={{ width: `${overview?.jurorsCount ? Math.round((overview.jurySubmitted / overview.jurorsCount) * 100) : 0}%` }} /></div></td>
                <td>{overview?.reviewVotes ? <span className="ks-cell-warning">{overview.reviewVotes} prüfen</span> : <span className="ks-cell-success">Bereit</span>}</td>
                <td>{overview?.songsCount || 0}</td>
                <td><strong>{overview?.totalVotes || 0}</strong><small>{overview?.countedVotes || 0} gewertet</small></td>
              </tr>;
            })}
            {!rounds.length && <tr><td colSpan={7} className="ks-table-empty">Keine passenden Umfragen gefunden.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="ks-pagination">
        <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} von ${total}` : '0 Umfragen'}</span>
        <div>
          <a aria-disabled={page <= 1} href={page > 1 ? href({ page: page - 1 }) : undefined}>←</a>
          {Array.from({ length: pages }, (_, index) => index + 1).slice(Math.max(0, page - 3), page + 2).map((number) => <a key={number} className={number === page ? 'active' : ''} href={href({ page: number })}>{number}</a>)}
          <a aria-disabled={page >= pages} href={page < pages ? href({ page: page + 1 }) : undefined}>→</a>
        </div>
      </div>
    </section>
  );
}
