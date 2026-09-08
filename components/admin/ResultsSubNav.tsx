type ResultsView = 'hub' | 'jury' | 'public' | 'overall' | 'podcast';

const ITEMS: Array<{ key: Exclude<ResultsView, 'hub'>; label: string; path: string }> = [
  { key: 'jury', label: 'Juryergebnisse', path: '/results/jury' },
  { key: 'public', label: 'Publikumsstimmen', path: '/results/public' },
  { key: 'overall', label: 'Gesamtwertung', path: '/results/overall' },
  { key: 'podcast', label: 'Sendungsausdruck', path: '/results/podcast' },
];

export default function ResultsSubNav({ roundId, active }: { roundId: string; active: ResultsView }) {
  const base = `/admin/release-voting/${roundId}`;
  return (
    <nav className="ks-round-view-nav no-print" aria-label="Ergebnisbereiche">
      <a className={active === 'hub' ? 'active' : ''} aria-current={active === 'hub' ? 'page' : undefined} href={`${base}/results`}>Ergebnisübersicht</a>
      {ITEMS.map((item) => (
        <a
          key={item.key}
          className={item.key === active ? 'active' : ''}
          aria-current={item.key === active ? 'page' : undefined}
          href={`${base}${item.path}`}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
