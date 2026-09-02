'use client';

import { useMemo } from 'react';
import { buildArtistHistories, sortWeeksNewestFirst } from '@/lib/releaseStatisticsCore';
import ArtistHistoryExplorer from './ArtistHistoryExplorer';
import RoundStatisticsPicker from './RoundStatisticsPicker';
import { useHistoricalWeeks } from './useHistoricalWeeks';

export default function HistoricalStatisticsLoader() {
  const { weeks, total, processed, warnings, error, loading, retry } = useHistoricalWeeks();
  const conducted = useMemo(() => sortWeeksNewestFirst(weeks.filter((week) => week.hasActivity)), [weeks]);
  const artists = useMemo(() => buildArtistHistories(conducted), [conducted]);

  return <>
    <section className="ks-card ks-history-load-status">
      <div><span className="ks-section-kicker">Historische Detaildaten</span><h2>{loading ? 'Historie wird im Hintergrund geladen' : 'Historie geladen'}</h2><p>{loading ? `${processed} von ${total || '…'} Umfragen verarbeitet. Die Seite bleibt währenddessen benutzbar.` : `${conducted.length} durchgeführte Umfragen und ${artists.length} Künstlerangaben ausgewertet.`}</p></div>
      {total > 0 && <div className="ks-history-progress" aria-label={`${processed} von ${total} geladen`}><i style={{ width: `${Math.min(100, (processed / total) * 100)}%` }} /></div>}
      {error && <div className="notice error"><strong>Historie konnte nicht vollständig geladen werden.</strong><br />{error}<div className="ks-inline-actions"><button className="ks-button small secondary" type="button" onClick={retry}>Erneut versuchen</button></div></div>}
      {warnings.length > 0 && <details className="ks-method-note"><summary>{warnings.length} ältere {warnings.length === 1 ? 'Umfrage konnte' : 'Umfragen konnten'} nicht ausgewertet werden</summary><ul>{warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></details>}
      {conducted.length > 0 && <RoundStatisticsPicker rounds={conducted.map((week) => ({ id: week.round.id, title: week.round.title, date: week.round.starts_at || week.round.created_at }))} />}
    </section>
    {(artists.length > 0 || !loading) && <ArtistHistoryExplorer artists={artists} />}
  </>;
}
