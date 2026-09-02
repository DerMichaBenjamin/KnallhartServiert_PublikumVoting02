'use client';

import { useMemo } from 'react';
import { buildArtistHistories, sortWeeksNewestFirst } from '@/lib/releaseStatisticsCore';
import ArtistHistoryExplorer from './ArtistHistoryExplorer';
import RoundStatisticsPicker from './RoundStatisticsPicker';
import { useHistoricalWeeks } from './useHistoricalWeeks';
import HistoricalRoundsTable from './HistoricalRoundsTable';
import { buildHistoricalExportSheets } from '@/lib/releaseStatisticsExport';
import { createCsv, createXlsxWorkbook } from '@/lib/tabularExport';

function downloadFile(content: string | Uint8Array, filename: string, type: string) {
  const part = typeof content === 'string'
    ? content
    : content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([part], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function HistoricalStatisticsLoader() {
  const { weeks, total, processed, warnings, error, loading, retry } = useHistoricalWeeks();
  const ordered = useMemo(() => sortWeeksNewestFirst(weeks), [weeks]);
  const conducted = useMemo(() => ordered.filter((week) => week.hasActivity), [ordered]);
  const artists = useMemo(() => buildArtistHistories(conducted), [conducted]);

  function exportAll(format: 'csv' | 'xlsx') {
    const sheets = buildHistoricalExportSheets(ordered, artists);
    if (format === 'csv') {
      downloadFile(createCsv(sheets[0].rows), 'release-check-gesamtauswertung.csv', 'text/csv;charset=utf-8');
    } else {
      downloadFile(createXlsxWorkbook(sheets), 'release-check-gesamtauswertung.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
  }

  return <>
    <section className="ks-card ks-history-load-status">
      <div><span className="ks-section-kicker">Historische Detaildaten</span><h2>{loading ? 'Historie wird im Hintergrund geladen' : 'Historie geladen'}</h2><p>{loading ? `${processed} von ${total || '…'} Umfragen verarbeitet. Die Seite bleibt währenddessen benutzbar.` : `${conducted.length} durchgeführte Umfragen und ${artists.length} Künstlerangaben ausgewertet.`}</p></div>
      {total > 0 && <div className="ks-history-progress" aria-label={`${processed} von ${total} geladen`}><i style={{ width: `${Math.min(100, (processed / total) * 100)}%` }} /></div>}
      {error && <div className="notice error"><strong>Historie konnte nicht vollständig geladen werden.</strong><br />{error}<div className="ks-inline-actions"><button className="ks-button small secondary" type="button" onClick={retry}>Erneut versuchen</button></div></div>}
      {warnings.length > 0 && <details className="ks-method-note"><summary>{warnings.length} ältere {warnings.length === 1 ? 'Umfrage konnte' : 'Umfragen konnten'} nicht ausgewertet werden</summary><ul>{warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></details>}
      {ordered.length > 0 && <RoundStatisticsPicker rounds={ordered.map((week) => ({ id: week.round.id, title: week.round.title, date: week.round.starts_at || week.round.created_at }))} />}
    </section>
    {ordered.length > 0 && <HistoricalRoundsTable weeks={ordered} />}
    <section className="ks-card ks-stat-section ks-historical-exports" id="historical-exports">
      <div><span className="ks-section-kicker">Externe Analysen</span><h2>Gesamtdaten exportieren</h2><p>CSV enthält alle Songzeilen. XLSX ergänzt Wochen- und Künstlerübersichten in eigenen Tabellenblättern.</p></div>
      <div className="ks-inline-actions"><button className="ks-button secondary" type="button" disabled={loading || !ordered.length} onClick={() => exportAll('csv')}>{loading ? 'Historie wird geladen …' : 'Alle Umfragen als CSV'}</button><button className="ks-button primary" type="button" disabled={loading || !ordered.length} onClick={() => exportAll('xlsx')}>{loading ? 'Historie wird geladen …' : 'Alle Umfragen als XLSX'}</button></div>
    </section>
    {(artists.length > 0 || !loading) && <ArtistHistoryExplorer artists={artists} />}
  </>;
}
