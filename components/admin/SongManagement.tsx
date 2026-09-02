'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AdminRoundSummary, Round, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { combineSongLine, findSongDuplicateGroups } from '@/lib/releaseVotingShared';
import { buildCombinedResults, type CombinedResultRow } from '@/lib/combinedVotingResults';
import { StatusBadge } from './AdminUi';
import PopoverMenu from './PopoverMenu';

type Post = (url: string, body: unknown) => Promise<boolean>;
type SortKey = 'audience' | 'juryAverage' | 'total';
type SortState = { key: SortKey; direction: 'asc' | 'desc' };

function sortValue(row: CombinedResultRow, key: SortKey) {
  if (key === 'audience') return row.audiencePoints;
  if (key === 'juryAverage') return row.juryAverage ?? Number.NEGATIVE_INFINITY;
  return row.total;
}

export default function SongManagement({ round, songs, summary, juryData, post }: { round: Round; songs: Song[]; summary: AdminRoundSummary; juryData: AdminJuryRoundData; post: Post }) {
  const [sort, setSort] = useState<SortState>({ key: 'total', direction: 'desc' });
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const duplicates = useMemo(() => findSongDuplicateGroups(songs), [songs]);
  const results = useMemo(() => buildCombinedResults(songs, summary.leaderboard, summary.countedVotes, juryData), [songs, summary.leaderboard, summary.countedVotes, juryData]);
  const rows = useMemo(() => [...results.overallRows].sort((left, right) => {
    const delta = sortValue(left, sort.key) - sortValue(right, sort.key);
    if (delta) return sort.direction === 'asc' ? delta : -delta;
    return (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER)
      || left.song.title.localeCompare(right.song.title, 'de');
  }), [results.overallRows, sort]);
  const zonkRows = summary.zonk.filter((row) => row.count > 0);

  useEffect(() => {
    function openFromHash() {
      if (window.location.hash === '#duplicate-check') setDuplicateOpen(true);
    }
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  function setSorting(key: SortKey) {
    setSort((current) => current.key === key ? { key, direction: current.direction === 'desc' ? 'asc' : 'desc' } : { key, direction: 'desc' });
  }

  function sortLabel(label: string, key: SortKey) {
    return <button type="button" className={sort.key === key ? 'active' : ''} onClick={() => setSorting(key)}>{label} <span aria-hidden="true">{sort.key === key ? (sort.direction === 'desc' ? '↓' : '↑') : '↕'}</span></button>;
  }

  function merge(targetSongId: string, sourceSongId: string) {
    const target = songs.find((song) => song.id === targetSongId);
    const source = songs.find((song) => song.id === sourceSongId);
    if (!target || !source || target.id === source.id) return;
    if (window.confirm(`„${combineSongLine(source)}“ wirklich in „${combineSongLine(target)}“ zusammenführen?`)) void post('/api/admin/merge-songs', { roundId: round.id, targetSongId, sourceSongId });
  }

  return <section className="ks-card" id="songs">
    <div className="ks-section-heading">
      <div><span className="ks-section-kicker">Ranking und Verwaltung</span><h2>Songs</h2><p>{songs.length} Songs befinden sich in der Wertung.</p></div>
      <PopoverMenu label="Song hinzufügen" trigger="+ Song hinzufügen" triggerClassName="ks-button primary" role="dialog" panelClassName="ks-form compact">
        {(close) => <form className="ks-form compact" onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          if (await post('/api/admin/add-songs', { roundId: round.id, songsText: form.get('songsText') })) close();
        }}>
          <label>Neue Songs<textarea name="songsText" rows={7} placeholder="Songtitel - Interpret" required /></label>
          <button className="ks-button primary" type="submit">Songs hinzufügen</button>
        </form>}
      </PopoverMenu>
    </div>
    <div className={`ks-duplicate-status ${duplicates.length ? 'warning' : 'success'}`}><span>{duplicates.length ? '!' : '✓'}</span><div><strong>{duplicates.length ? `${duplicates.length} mögliche Doppler` : 'Keine Doppler erkannt'}</strong><small>{duplicates.length ? 'Bitte vor dem Abschluss prüfen.' : 'Die vorhandene Dopplerprüfung meldet keine Treffer.'}</small></div>{duplicates.length > 0 && <a href="#duplicate-check" onClick={() => setDuplicateOpen(true)}>Doppler prüfen</a>}</div>
    <div className="ks-table-scroll">
      <table className="ks-table songs">
        <thead><tr><th>Gesamtrang</th><th>Song</th><th>Künstler</th><th className="ks-sortable-th" aria-sort={sort.key === 'audience' ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}>{sortLabel('Publikum', 'audience')}</th><th className="ks-sortable-th" aria-sort={sort.key === 'juryAverage' ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}>{sortLabel('Jury Ø', 'juryAverage')}</th><th className="ks-sortable-th" aria-sort={sort.key === 'total' ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}>{sortLabel('Gesamt', 'total')}</th><th>Status</th><th>Aktionen</th></tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.song.id}><td><strong>{row.rank ?? '—'}</strong></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist || '—'}</td><td>{row.audiencePoints}</td><td>{row.juryAverage === null ? '—' : row.juryAverage.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td><td><strong>{row.total}</strong></td><td><StatusBadge status="success">In Wertung</StatusBadge></td><td><button className="ks-button small secondary" type="button" disabled title="Für Song-Deaktivierung existiert derzeit kein nicht-destruktiver Datenstatus.">Deaktivieren</button></td></tr>)}
          {!songs.length && <tr><td colSpan={8} className="ks-table-empty">Keine Songs vorhanden.</td></tr>}
        </tbody>
      </table>
    </div>

    <details className="ks-disclosure" id="duplicate-check" open={duplicateOpen} onToggle={(event) => setDuplicateOpen(event.currentTarget.open)}><summary>Doppler prüfen und Songs zusammenführen <span>{duplicates.length}</span></summary><div className="ks-disclosure-body"><p>Die bestehende Merge-Funktion überträgt Publikums-, Jury- und ZONK-Wertungen und entfernt anschließend nur den doppelten Quelldatensatz.</p>{duplicates.map((group) => <div className="ks-duplicate-group" key={group.key}><strong>{group.kind === 'exact' ? 'Exakter Doppler' : 'Möglicher Doppler'}</strong><ul>{group.songs.map((song) => <li key={song.id}>{combineSongLine(song)}</li>)}</ul>{group.songs.slice(1).map((source) => <button className="ks-button secondary" key={source.id} type="button" onClick={() => merge(group.songs[0].id, source.id)}>{combineSongLine(source)} zusammenführen</button>)}</div>)}{songs.length > 1 && <form className="ks-form compact ks-manual-merge" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); merge(String(form.get('targetSongId') || ''), String(form.get('sourceSongId') || '')); }}><div className="ks-form-row two"><label>Ziel behalten<select name="targetSongId" defaultValue={songs[0]?.id}>{songs.map((song) => <option key={song.id} value={song.id}>{combineSongLine(song)}</option>)}</select></label><label>Doppler zusammenführen<select name="sourceSongId" defaultValue={songs[1]?.id}>{songs.map((song) => <option key={song.id} value={song.id}>{combineSongLine(song)}</option>)}</select></label></div><button className="ks-button secondary" type="submit">Ausgewählte Songs zusammenführen</button></form>}</div></details>
    {zonkRows.length > 0 && <details className="ks-disclosure"><summary>ZONK-Auswertung <span>{zonkRows.length}</span></summary><div className="ks-disclosure-body"><ol className="ks-zonk-list">{zonkRows.map((entry) => <li key={entry.song.id}><span>{combineSongLine(entry.song)}</span><strong>{entry.count}</strong></li>)}</ol></div></details>}
    <p className="ks-schema-note"><strong>Song deaktivieren:</strong> bewusst noch ohne Aktion. Im vorhandenen Schema gibt es keinen nicht-destruktiven Aktivstatus; daher wird keine Löschung als Ersatz angeboten.</p>
  </section>;
}
