type RoundView = 'overview' | 'results' | 'statistics' | 'report';

const ITEMS: Array<{ key: RoundView; label: string; path: string }> = [
  { key: 'overview', label: 'Übersicht / Umfrage', path: '' },
  { key: 'results', label: 'Ergebnisse', path: '/results' },
  { key: 'statistics', label: 'Statistiken', path: '/statistics' },
  { key: 'report', label: 'Gesamtauswertung', path: '/report' },
];

export default function RoundViewNav({ roundId, active }: { roundId: string; active: RoundView }) {
  const base = `/admin/release-voting/${roundId}`;
  return <nav className="ks-round-view-nav no-print" aria-label="Bereiche dieser Umfrage">
    {ITEMS.map((item) => <a key={item.key} className={item.key === active ? 'active' : ''} aria-current={item.key === active ? 'page' : undefined} href={`${base}${item.path}`}>{item.label}</a>)}
  </nav>;
}
