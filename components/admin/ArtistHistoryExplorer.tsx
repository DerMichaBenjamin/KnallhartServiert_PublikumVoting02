'use client';

import { useMemo, useState } from 'react';
import type { ArtistHistory } from '@/lib/releaseStatisticsCore';

const COLORS = ['#6d4ee8', '#e97919', '#168657'];

function rank(value: number | null) {
  return value === null ? '—' : value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function shortDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
}

function ArtistTimeline({ artists }: { artists: ArtistHistory[] }) {
  const datedEntries = artists.flatMap((artist) => artist.entries.filter((entry) => entry.overallRank !== null));
  if (!datedEntries.length) return <p className="ks-muted-copy">Für die Auswahl liegen noch keine abgeschlossenen Platzierungen vor.</p>;
  const dates = [...new Set(datedEntries.map((entry) => entry.date))].sort((a, b) => Date.parse(a) - Date.parse(b));
  const maxRank = Math.max(5, ...datedEntries.map((entry) => entry.overallRank || 1));
  const x = (date: string) => dates.length === 1 ? 450 : 75 + (dates.indexOf(date) / (dates.length - 1)) * 785;
  const y = (value: number) => 45 + ((value - 1) / Math.max(1, maxRank - 1)) * 250;
  const gridRanks = [...new Set([1, 3, 5, maxRank].filter((value) => value <= maxRank))].sort((a, b) => a - b);

  return <div className="ks-artist-chart-wrap">
    <svg className="ks-artist-chart" viewBox="0 0 920 350" role="img" aria-label="Verlauf der Gesamtplatzierungen">
      {gridRanks.map((value) => <g key={value}><line x1="65" x2="875" y1={y(value)} y2={y(value)} stroke="#dfe5ee" strokeWidth="1" /><text x="50" y={y(value) + 5} textAnchor="end" fill="#64748b" fontSize="14">{value}</text></g>)}
      {artists.map((artist, artistIndex) => {
        const entries = artist.entries.filter((entry) => entry.overallRank !== null).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
        const points = entries.map((entry) => `${x(entry.date)},${y(entry.overallRank || 1)}`).join(' ');
        return <g key={artist.key}>
          {entries.length > 1 && <polyline points={points} fill="none" stroke={COLORS[artistIndex]} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
          {entries.map((entry) => <circle key={`${entry.roundId}-${entry.songId}`} cx={x(entry.date)} cy={y(entry.overallRank || 1)} r="7" fill={COLORS[artistIndex]} stroke="#fff" strokeWidth="3"><title>{artist.name}: Platz {entry.overallRank} · {entry.roundTitle} · {entry.songTitle}</title></circle>)}
        </g>;
      })}
      {dates.map((date, index) => {
        const show = dates.length <= 8 || index === 0 || index === dates.length - 1 || index % Math.ceil(dates.length / 6) === 0;
        return show ? <text key={date} x={x(date)} y="330" textAnchor="middle" fill="#64748b" fontSize="13">{shortDate(date)}</text> : null;
      })}
    </svg>
    <div className="ks-chart-legend">{artists.map((artist, index) => <span key={artist.key}><i style={{ background: COLORS[index] }} />{artist.name}</span>)}</div>
  </div>;
}

export default function ArtistHistoryExplorer({ artists }: { artists: ArtistHistory[] }) {
  const [query, setQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const selected = selectedKeys.map((key) => artists.find((artist) => artist.key === key)).filter((artist): artist is ArtistHistory => Boolean(artist));
  const suggestions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('de-DE');
    if (!normalized) return [];
    return artists.filter((artist) => !selectedKeys.includes(artist.key) && artist.name.toLocaleLowerCase('de-DE').includes(normalized)).slice(0, 8);
  }, [artists, query, selectedKeys]);

  function add(key: string) {
    if (selectedKeys.includes(key) || selectedKeys.length >= 3) return;
    setSelectedKeys((current) => [...current, key]);
    setQuery('');
  }

  return <section className="ks-card ks-stat-section" id="artist-history">
    <div className="ks-section-heading"><div><span className="ks-section-kicker">Historische Auswertung</span><h2>Künstlerhistorie und Vergleich</h2><p>Bis zu drei einzelne Künstler auswählen – auch Feature-Gäste und Mitglieder gemeinsamer Song-Credits werden separat ausgewertet.</p></div></div>
    <div className="ks-artist-picker">
      <label><span>Künstler suchen</span><input type="search" value={query} disabled={selected.length >= 3} placeholder={selected.length >= 3 ? 'Maximal drei ausgewählt' : 'Name eingeben …'} role="combobox" aria-expanded={suggestions.length > 0} aria-controls="artist-suggestions" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && suggestions[0]) { event.preventDefault(); add(suggestions[0].key); } }} /></label>
      {suggestions.length > 0 && <div className="ks-artist-suggestions" id="artist-suggestions" role="listbox">{suggestions.map((artist) => <button key={artist.key} type="button" role="option" aria-selected="false" onClick={() => add(artist.key)}><strong>{artist.name}</strong><span>{artist.participations} {artist.participations === 1 ? 'Teilnahme' : 'Teilnahmen'}</span></button>)}</div>}
      <div className="ks-selected-artists">{selected.map((artist, index) => <button key={artist.key} type="button" style={{ borderColor: COLORS[index] }} onClick={() => setSelectedKeys((current) => current.filter((key) => key !== artist.key))}>{artist.name}<span aria-hidden="true">×</span></button>)}</div>
    </div>

    {!selected.length && <div className="ks-artist-empty"><strong>{artists.length} einzelne Künstler verfügbar</strong><p>Beginne oben mit der Suche. Gemeinsame Credits werden in einzelne Künstler zerlegt; unterschiedliche Schreibweisen werden weiterhin nicht automatisch vermischt.</p></div>}
    {selected.length > 0 && <>
      <div className={`ks-artist-card-grid count-${selected.length}`}>{selected.map((artist, index) => <article key={artist.key} style={{ borderTopColor: COLORS[index] }}><header><strong>{artist.name}</strong><small>Letzte Teilnahme: {shortDate(artist.lastParticipation)}</small></header><dl><div><dt>Teilnahmen</dt><dd>{artist.participations}</dd></div><div><dt>Ø Platz</dt><dd>{rank(artist.averageRank)}</dd></div><div><dt>Beste</dt><dd>{artist.bestRank ?? '—'}</dd></div><div><dt>Schlechteste</dt><dd>{artist.worstRank ?? '—'}</dd></div><div><dt>Siege</dt><dd>{artist.wins}</dd></div><div><dt>Top 3 / Top 5</dt><dd>{artist.top3} / {artist.top5}</dd></div><div><dt>Publikum Ø Platz</dt><dd>{rank(artist.averageAudienceRank)}</dd></div><div><dt>Jury Ø Platz</dt><dd>{rank(artist.averageJuryRank)}</dd></div></dl></article>)}</div>
      <div className="ks-artist-timeline"><h3>Platzierungsverlauf</h3><p>Platz 1 steht oben. Punkte zeigen einzelne Songteilnahmen; Details erscheinen beim Darüberfahren.</p><ArtistTimeline artists={selected} /></div>
      <div className="ks-table-scroll"><table className="ks-table"><thead><tr><th>Künstler</th><th>Teilnahmen</th><th>Ø Platz</th><th>Beste</th><th>Siege</th><th>Top 3</th><th>Top 5</th><th>Publikum Ø</th><th>Jury Ø</th></tr></thead><tbody>{selected.map((artist) => <tr key={artist.key}><td><strong>{artist.name}</strong></td><td>{artist.participations}</td><td>{rank(artist.averageRank)}</td><td>{artist.bestRank ?? '—'}</td><td>{artist.wins}</td><td>{artist.top3}</td><td>{artist.top5}</td><td>{rank(artist.averageAudienceRank)}</td><td>{rank(artist.averageJuryRank)}</td></tr>)}</tbody></table></div>
      {selected.length === 1 && <div className="ks-artist-history-list"><h3>Teilnahmen</h3>{selected[0].entries.slice().reverse().map((entry) => <a key={`${entry.roundId}-${entry.songId}`} href={`/admin/release-voting/${entry.roundId}/results`}><span><strong>{entry.songTitle}</strong><small>{entry.roundTitle} · {shortDate(entry.date)}</small></span><b>Platz {entry.overallRank ?? '—'}</b></a>)}</div>}
    </>}
  </section>;
}
