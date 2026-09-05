'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AdminRoundSummary, Round, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { combineSongLine, findSongDuplicateGroups, isSongActive, splitSongLine } from '@/lib/releaseVotingShared';
import { buildCombinedResults, type CombinedResultRow } from '@/lib/combinedVotingResults';
import { StatusBadge } from './AdminUi';
import PopoverMenu from './PopoverMenu';

type Post = (url: string, body: unknown) => Promise<boolean>;
type SortKey = 'audience' | 'averagePoints';
type SortState = { key: SortKey; direction: 'asc' | 'desc' };

function sortValue(row: CombinedResultRow, key: SortKey) {
  if (key === 'audience') return row.audiencePoints;
  return row.averagePoints ?? Number.NEGATIVE_INFINITY;
}

function rankLabel(value: number | null) {
  return value === null ? '—' : `#${value}`;
}

function pointsLabel(value: number) {
  return `${value} Pkt.`;
}

function averagePointsLabel(value: number | null) {
  return value === null ? '—' : `Ø ${value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

export default function SongManagement({ round, songs, summary, juryData, post }: { round: Round; songs: Song[]; summary: AdminRoundSummary; juryData: AdminJuryRoundData; post: Post }) {
  const [sort, setSort] = useState<SortState>({ key: 'averagePoints', direction: 'desc' });
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [bulkMerging, setBulkMerging] = useState(false);
  const activeSongs = useMemo(() => songs.filter(isSongActive), [songs]);
  const inactiveSongs = useMemo(() => songs.filter((song) => !isSongActive(song)), [songs]);
  const duplicates = useMemo(() => findSongDuplicateGroups(activeSongs), [activeSongs]);
  const exactDuplicates = useMemo(() => duplicates.filter((group) => group.kind === 'exact'), [duplicates]);
  const possibleDuplicates = duplicates.length - exactDuplicates.length;
  const results = useMemo(() => buildCombinedResults(activeSongs, summary.leaderboard, summary.countedVotes, juryData), [activeSongs, summary.leaderboard, summary.countedVotes, juryData]);
  const audienceBySong = useMemo(() => new Map(results.audienceResults.map((row) => [row.song.id, row])), [results.audienceResults]);
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

  function setSongActive(song: Song, isActive: boolean) {
    if (!isActive && !window.confirm(`„${combineSongLine(song)}“ deaktivieren? Der Song wird aus Publikumsvoting, Jury-Voting, Top-5, Ergebnissen und Statistiken entfernt. Alle vorhandenen Wertungen bleiben erhalten.`)) return;
    void post('/api/admin/song-status', { roundId: round.id, songId: song.id, isActive });
  }

  function preferredDuplicateOrder(groupSongs: Song[]) {
    return [...groupSongs].sort((left, right) => {
      const leftParsed = splitSongLine(left.title);
      const rightParsed = splitSongLine(right.title);
      const leftQuality = Number(Boolean(left.artist.trim())) * 2 + Number(!leftParsed.artist);
      const rightQuality = Number(Boolean(right.artist.trim())) * 2 + Number(!rightParsed.artist);
      return rightQuality - leftQuality || left.sort_order - right.sort_order;
    });
  }

  async function mergeAllExactDuplicates() {
    const mergeCount = exactDuplicates.reduce((sum, group) => sum + Math.max(0, group.songs.length - 1), 0);
    if (!mergeCount || !window.confirm(`${mergeCount} eindeutig doppelte Song-Datensätze zusammenführen? Vorhandene Publikums-, Jury- und ZONK-Wertungen werden auf den jeweils beibehaltenen Song übertragen.`)) return;
    setBulkMerging(true);
    try {
      for (const group of exactDuplicates) {
        const [target, ...sources] = preferredDuplicateOrder(group.songs);
        for (const source of sources) {
          const ok = await post('/api/admin/merge-songs', { roundId: round.id, targetSongId: target.id, sourceSongId: source.id });
          if (!ok) return;
        }
      }
    } finally {
      setBulkMerging(false);
    }
  }

  return <section className="ks-card" id="songs">
    <div className="ks-section-heading">
      <div><span className="ks-section-kicker">Ranking und Verwaltung</span><h2>Songs</h2><p>{activeSongs.length} Songs befinden sich in der Wertung.{inactiveSongs.length ? ` ${inactiveSongs.length} Songs sind deaktiviert.` : ''}</p></div>
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
    <div className={`ks-duplicate-status ${duplicates.length ? 'warning' : 'success'}`}><span>{duplicates.length ? '!' : '✓'}</span><div><strong>{duplicates.length ? `${duplicates.length} Doppler-Gruppen erkannt` : 'Keine Doppler erkannt'}</strong><small>{duplicates.length ? `${exactDuplicates.length} eindeutig · ${possibleDuplicates} nur möglicherweise doppelt` : 'Die vorhandene Dopplerprüfung meldet keine Treffer.'}</small></div>{duplicates.length > 0 && <div className="ks-duplicate-status-actions"><a href="#duplicate-check" onClick={() => setDuplicateOpen(true)}>Einzeln prüfen</a>{exactDuplicates.length > 0 && <button className="ks-button small primary" type="button" disabled={bulkMerging} onClick={() => void mergeAllExactDuplicates()}>{bulkMerging ? 'Bereinigung läuft …' : 'Eindeutige Doppler bereinigen'}</button>}</div>}</div>
    <div className="ks-table-scroll">
      <table className="ks-table songs">
        <thead><tr><th>Gesamt</th><th>Song</th><th>Künstler</th><th className="ks-sortable-th" aria-sort={sort.key === 'audience' ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}>{sortLabel('Publikum', 'audience')}</th><th className="ks-sortable-th" aria-sort={sort.key === 'averagePoints' ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}>{sortLabel('Ø Punkte', 'averagePoints')}</th><th>Status</th><th>Aktionen</th></tr></thead>
        <tbody>
          {rows.map((row) => { const audience = audienceBySong.get(row.song.id); return <tr key={row.song.id}><td><strong>{rankLabel(row.rank)}</strong></td><td><strong>{row.song.title}</strong></td><td>{row.song.artist || '—'}</td><td>{summary.countedVotes > 0 ? <strong>{audience ? `${rankLabel(audience.rank)} · ${pointsLabel(row.audiencePoints)}` : `— · ${pointsLabel(0)}`}</strong> : '—'}</td><td><strong>{averagePointsLabel(row.averagePoints)}</strong></td><td><StatusBadge status="success">In Wertung</StatusBadge></td><td><button className="ks-button small warning" type="button" onClick={() => setSongActive(row.song, false)}>Deaktivieren</button></td></tr>; })}
          {inactiveSongs.map((song) => <tr key={song.id} className="ks-song-row-inactive"><td>—</td><td><strong>{song.title}</strong></td><td>{song.artist || '—'}</td><td>—</td><td>—</td><td><StatusBadge status="muted">Deaktiviert</StatusBadge></td><td><button className="ks-button small success" type="button" onClick={() => setSongActive(song, true)}>Aktivieren</button></td></tr>)}
          {!songs.length && <tr><td colSpan={7} className="ks-table-empty">Keine Songs vorhanden.</td></tr>}
        </tbody>
      </table>
    </div>

    <details className="ks-disclosure" id="duplicate-check" open={duplicateOpen} onToggle={(event) => setDuplicateOpen(event.currentTarget.open)}><summary>Doppler prüfen und Songs zusammenführen <span>{duplicates.length}</span></summary><div className="ks-disclosure-body"><p>Die bestehende Merge-Funktion überträgt Publikums-, Jury- und ZONK-Wertungen und entfernt anschließend nur den doppelten Quelldatensatz. Deaktivierte Songs werden nicht als offene Doppler gezählt.</p>{duplicates.map((group) => <div className="ks-duplicate-group" key={group.key}><strong>{group.kind === 'exact' ? 'Exakter Doppler' : 'Möglicher Doppler'}</strong><ul>{group.songs.map((song) => <li key={song.id}>{combineSongLine(song)}</li>)}</ul>{group.songs.slice(1).map((source) => <button className="ks-button secondary" key={source.id} type="button" onClick={() => merge(group.songs[0].id, source.id)}>{combineSongLine(source)} zusammenführen</button>)}</div>)}{activeSongs.length > 1 && <form className="ks-form compact ks-manual-merge" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); merge(String(form.get('targetSongId') || ''), String(form.get('sourceSongId') || '')); }}><div className="ks-form-row two"><label>Ziel behalten<select name="targetSongId" defaultValue={activeSongs[0]?.id}>{activeSongs.map((song) => <option key={song.id} value={song.id}>{combineSongLine(song)}</option>)}</select></label><label>Doppler zusammenführen<select name="sourceSongId" defaultValue={activeSongs[1]?.id}>{activeSongs.map((song) => <option key={song.id} value={song.id}>{combineSongLine(song)}</option>)}</select></label></div><button className="ks-button secondary" type="submit">Ausgewählte Songs zusammenführen</button></form>}</div></details>
    {zonkRows.length > 0 && <details className="ks-disclosure"><summary>ZONK-Auswertung <span>{zonkRows.length}</span></summary><div className="ks-disclosure-body"><ol className="ks-zonk-list">{zonkRows.map((entry) => <li key={entry.song.id}><span>{combineSongLine(entry.song)}</span><strong>{entry.count}</strong></li>)}</ol></div></details>}
    <p className="ks-schema-note"><strong>Deaktivieren löscht nichts:</strong> Songdaten und bereits abgegebene Wertungen bleiben erhalten. Der Song wird nur aus der aktiven Wertung genommen und kann jederzeit wieder aktiviert werden.</p>
  </section>;
}
