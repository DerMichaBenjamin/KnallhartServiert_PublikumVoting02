'use client';

import { useEffect, useState } from 'react';

type Category = 'jury' | 'dj';
type MatchReview = { sourceSong: string; matchedSong: string; strategy: string; confidence: number };
type JurorReport = {
  sourceName: string;
  displayName: string;
  category: Category;
  status: 'ready-new' | 'ready-existing' | 'already-imported' | 'blocked' | 'conflict' | 'ignored';
  message: string;
  matchedSongs: number;
  matchReviews: MatchReview[];
  missingSongs: Array<{
    sourceSong: string;
    suggestions: Array<{ id: string | null; label: string; confidence: number | null }>;
    mappingValue: string;
  }>;
  jurorMappingValue: string;
};
type RankingItem = { songLabel: string; points: number };
type SkippedColumn = {
  sourceName: string;
  displayName: string;
  category: Category;
  reason: string;
  rankingCount: number;
  sum: number;
  missingPoints: number[];
  duplicatePoints: Array<{ point: number; count: number }>;
  ranking: RankingItem[];
  currentRanking: RankingItem[];
  corrected: boolean;
  ignored: boolean;
};
type RoundReport = {
  sheet: string;
  votingDate: string;
  sourceSongs: number;
  targetRound: { id: string; title: string } | null;
  roundMappingValue: string;
  status: 'ready' | 'partial' | 'blocked' | 'complete';
  jurors: JurorReport[];
  skippedColumns: SkippedColumn[];
  zonkEntries: number;
  songOptions: Array<{ id: string; label: string }>;
  jurorOptions: Array<{ id: string; displayName: string; category: Category }>;
};
type ImportReport = {
  sourceFile: string;
  generatedAt: string;
  roundOptions: Array<{ id: string; title: string; period: string }>;
  summary: {
    sourceRounds: number;
    matchedRounds: number;
    validSourceVotes: number;
    validJuryVotes: number;
    validDjVotes: number;
    readyVotes: number;
    readyJuryVotes: number;
    readyDjVotes: number;
    alreadyImportedVotes: number;
    blockedVotes: number;
    conflictingVotes: number;
    ignoredVotes: number;
    invalidSourceVotes: number;
    emptySourceColumns: number;
    zonkEntriesNotImported: number;
    reviewedSongMatches: number;
  };
  rounds: RoundReport[];
};

const AUTO = '__auto__';
const NEW = '__new__';
const IGNORE = '__ignore__';

const jurorLabels: Record<JurorReport['status'], string> = {
  'ready-new': 'Neu importierbar',
  'ready-existing': 'Wertung ergänzen',
  'already-imported': 'Bereits vorhanden',
  blocked: 'Zuordnung offen',
  conflict: 'Konflikt',
  ignored: 'Bewusst ignoriert',
};

function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('de-DE').format(date);
}

function statusTone(status: JurorReport['status'] | RoundReport['status']) {
  if (status === 'ready' || status === 'ready-new' || status === 'ready-existing') return 'success';
  if (status === 'complete' || status === 'already-imported' || status === 'ignored') return 'neutral';
  if (status === 'partial' || status === 'blocked') return 'warning';
  return 'danger';
}

function CategoryBadge({ category }: { category: Category }) {
  return <span className={`ks-import-category ${category}`}>{category === 'dj' ? 'DJ – separat' : 'Jury'}</span>;
}

function RankingCorrection({ round, column, busy, onSave }: {
  round: RoundReport;
  column: SkippedColumn;
  busy: boolean;
  onSave: (payload: Record<string, unknown>, key: string) => Promise<void>;
}) {
  const [ranking, setRanking] = useState(column.currentRanking);
  useEffect(() => { setRanking(column.currentRanking); }, [column.currentRanking]);
  const activePoints = ranking.filter((item) => Number(item.points) > 0).map((item) => Number(item.points));
  const isValid = activePoints.length === 12 && new Set(activePoints).size === 12
    && activePoints.every((point) => Number.isInteger(point) && point >= 1 && point <= 12);
  const key = `${round.sheet}:${column.sourceName}:ranking`;

  return <div className="ks-import-correction">
    <p><strong>Excel-Punkte kontrollieren</strong><br /><small>Wähle genau einmal jeden Wert von 12 bis 1. Bei 13 Zeilen muss eine Zeile „nicht übernehmen“ bleiben.</small></p>
    <div className="ks-import-ranking-grid">
      {ranking.map((item, index) => <label key={`${item.songLabel}-${index}`}>
        <span>{item.songLabel}</span>
        <select value={String(item.points)} onChange={(event) => setRanking((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, points: Number(event.target.value) } : row))}>
          {!Number.isInteger(item.points) && <option value={String(item.points)}>{item.points} (ungültig)</option>}
          <option value="0">Nicht übernehmen</option>
          {Array.from({ length: 12 }, (_, pointIndex) => 12 - pointIndex).map((point) => <option key={point} value={point}>{point} Punkte</option>)}
        </select>
      </label>)}
    </div>
    <div className="ks-inline-actions">
      <button className="ks-button primary small" type="button" disabled={busy || !isValid} onClick={() => void onSave({ mappingType: 'ranking', sheet: round.sheet, sourceName: column.sourceName, ranking }, key)}>
        {column.corrected ? 'Korrektur aktualisieren' : 'Korrektur speichern'}
      </button>
      {column.corrected && <button className="ks-button secondary small" type="button" disabled={busy} onClick={() => void onSave({ mappingType: 'ranking', sheet: round.sheet, sourceName: column.sourceName }, key)}>Korrektur entfernen</button>}
      <span className={`ks-import-validation ${isValid ? 'valid' : ''}`}>{isValid ? '✓ Gültige Top 12' : `${activePoints.length}/12 belegt · Punkte müssen eindeutig sein`}</span>
    </div>
  </div>;
}

export default function HistoricalJuryImportPanel() {
  const [report, setReport] = useState<ImportReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadReport() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/historical-jury-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dry-run' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Dry-Run fehlgeschlagen.');
      setReport(payload.report);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Dry-Run fehlgeschlagen.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadReport(); }, []);

  async function saveMapping(payload: Record<string, unknown>, key: string) {
    setSavingKey(key);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/historical-jury-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-mapping', ...payload }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Zuordnung konnte nicht gespeichert werden.');
      setReport(data.report);
      setMessage('Zuordnung gespeichert und alle betroffenen Wertungen neu geprüft.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Zuordnung konnte nicht gespeichert werden.');
    } finally { setSavingKey(''); }
  }

  async function applyImport() {
    if (!report || !confirmed || report.summary.readyVotes < 1) return;
    if (!window.confirm(`${report.summary.readyVotes} sichere Wertungen jetzt importieren? Offene und abweichende Datensätze bleiben unverändert.`)) return;
    setApplying(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/historical-jury-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'apply' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Import fehlgeschlagen.');
      setReport(payload.report);
      setConfirmed(false);
      setMessage(`${payload.importedJuryVotes} Jurywertungen und ${payload.importedDjVotes} separate DJ-Wertungen wurden importiert. Offene Fälle können anschließend weiter bearbeitet werden.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Import fehlgeschlagen.');
    } finally { setApplying(false); }
  }

  if (loading) return <section className="ks-card ks-import-loading" aria-live="polite"><strong>Historische Daten werden geprüft …</strong><p>Runden, Songs und vorhandene Wertungen werden nur gelesen. Es wird noch nichts importiert.</p></section>;
  if (!report) return <section className="notice error" role="alert"><strong>Der Import-Dry-Run konnte nicht erstellt werden.</strong><span>{error}</span><span>Falls „voting_role“ fehlt, zuerst die mitgelieferte SQL-Datei zur DJ-Trennung in Supabase ausführen.</span><button className="ks-button secondary" type="button" onClick={() => void loadReport()}>Erneut prüfen</button></section>;

  const summary = report.summary;
  return <>
    {message && <div className="notice success" role="status"><strong>Aktualisiert</strong><span>{message}</span></div>}
    {error && <div className="notice error" role="alert"><strong>Aktion nicht durchgeführt</strong><span>{error}</span></div>}

    <section className="ks-stats-grid dashboard ks-import-summary" aria-label="Import-Zusammenfassung">
      <article className="ks-stat-card violet"><span>Excel-Wochen</span><strong>{summary.sourceRounds}</strong><small>{summary.matchedRounds} Datenbankrunden zugeordnet</small></article>
      <article className="ks-stat-card success"><span>Jurywertungen</span><strong>{summary.validJuryVotes}</strong><small>{summary.readyJuryVotes} jetzt importierbar</small></article>
      <article className="ks-stat-card violet"><span>DJ separat</span><strong>{summary.validDjVotes}</strong><small>{summary.readyDjVotes} importierbar · nie Gesamtwertung</small></article>
      <article className="ks-stat-card"><span>Bereits vorhanden</span><strong>{summary.alreadyImportedVotes}</strong><small>werden nicht doppelt angelegt</small></article>
      <article className="ks-stat-card warning"><span>Offene Zuordnungen</span><strong>{summary.blockedVotes}</strong><small>unten direkt bearbeitbar</small></article>
      <article className="ks-stat-card danger"><span>Echte Datenkonflikte</span><strong>{summary.conflictingVotes + summary.invalidSourceVotes}</strong><small>werden nie automatisch überschrieben</small></article>
    </section>

    <section className="ks-card ks-import-safety">
      <div><h2>Sicherer Teilimport</h2><p>Du kannst alle grünen Wertungen sofort importieren. Gelbe und rote Fälle bleiben offen und können danach weiter zugeordnet werden.</p></div>
      <ul>
        <li>Wochen-, Song- und Juror-Zuordnungen werden dauerhaft in den vorhandenen App-Einstellungen gespeichert.</li>
        <li>Bestehende identische Wertungen werden übersprungen; abweichende Wertungen werden niemals überschrieben.</li>
        <li>DJ-Spalten werden als eigene Kategorie importiert und aus Jury-, Publikums- und Gesamtwertung ausgeschlossen.</li>
        <li>{summary.zonkEntriesNotImported} historische Jury-ZONKs bleiben unberührt, weil das aktuelle Jury-Schema dafür kein Feld besitzt.</li>
      </ul>
      <label className="ks-import-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>Nur die aktuell grün markierten, eindeutig zugeordneten Wertungen importieren.</span></label>
      <div className="ks-inline-actions">
        <button className="ks-button primary" type="button" disabled={!confirmed || applying || summary.readyVotes < 1} onClick={() => void applyImport()}>{applying ? 'Import läuft …' : `${summary.readyVotes} sichere Wertungen importieren`}</button>
        <button className="ks-button secondary" type="button" disabled={applying || Boolean(savingKey)} onClick={() => void loadReport()}>Dry-Run aktualisieren</button>
        {summary.ignoredVotes > 0 && <small>{summary.ignoredVotes} Wertungen/Spalten bewusst ignoriert</small>}
      </div>
    </section>

    <section className="ks-import-rounds">
      {report.rounds.map((round) => {
        const needsAttention = round.jurors.some((juror) => juror.status === 'blocked' || juror.status === 'conflict')
          || round.skippedColumns.some((column) => !column.corrected && !column.ignored && column.rankingCount > 0);
        const roundKey = `${round.sheet}:round`;
        return <details className="ks-card" key={round.sheet} open={needsAttention}>
          <summary>
            <span><strong>{dateLabel(round.votingDate)}</strong><small>{round.targetRound?.title || 'Keine Datenbankrunde zugeordnet'}</small></span>
            <span className={`ks-status-badge ${statusTone(round.status)}`}>{round.status === 'complete' ? 'Vollständig/erledigt' : round.status === 'ready' ? 'Importierbar' : round.status === 'partial' ? 'Teilweise importierbar' : 'Prüfung nötig'}</span>
          </summary>
          <div className="ks-import-round-body">
            <div className="ks-import-round-mapping">
              <label><span>Diese Excel-Woche gehört zu</span>
                <select value={round.roundMappingValue || round.targetRound?.id || ''} disabled={Boolean(savingKey)} onChange={(event) => void saveMapping({ mappingType: 'round', sheet: round.sheet, value: event.target.value }, roundKey)}>
                  <option value="">Automatisch anhand Datum erkennen</option>
                  {report.roundOptions.map((option) => <option key={option.id} value={option.id}>{option.period} · {option.title}</option>)}
                </select>
              </label>
              {savingKey === roundKey && <small>Zuordnung wird gespeichert …</small>}
            </div>
            <p className="ks-import-source-note">Excel: {round.sourceSongs} Songs · {round.jurors.length} geprüfte Wertungen · {round.zonkEntries} Jury-ZONKs ohne Zielfeld</p>
            <div className="ks-import-jurors">
              {round.jurors.map((juror) => {
                const jurorKey = `${round.sheet}:${juror.sourceName}:juror`;
                return <article key={`${round.sheet}-${juror.sourceName}-${juror.category}`}>
                  <header><div><strong>{juror.displayName}</strong><small>Excel: {juror.sourceName}</small></div><span><CategoryBadge category={juror.category} /><span className={`ks-status-badge ${statusTone(juror.status)}`}>{jurorLabels[juror.status]}</span></span></header>
                  <p>{juror.message} · {juror.matchedSongs}/12 Songs</p>
                  {round.targetRound && <label className="ks-import-compact-select"><span>Ziel-Zuordnung</span>
                    <select value={juror.jurorMappingValue} disabled={Boolean(savingKey)} onChange={(event) => void saveMapping({ mappingType: 'juror', sheet: round.sheet, sourceName: juror.sourceName, value: event.target.value }, jurorKey)}>
                      <option value={AUTO}>Automatisch nach Namen</option>
                      <option value={NEW}>Neue {juror.category === 'dj' ? 'DJ-Kategorie' : 'Jury-Zuordnung'} anlegen</option>
                      {round.jurorOptions.filter((option) => option.category === juror.category).map((option) => <option key={option.id} value={option.id}>Vorhanden: {option.displayName}</option>)}
                      <option value={IGNORE}>Diese Wertung bewusst ignorieren</option>
                    </select>
                  </label>}
                  {juror.matchReviews.length > 0 && <details className="ks-import-review"><summary>{juror.matchReviews.length} automatisch zugeordnete Songnamen</summary><ul>{juror.matchReviews.map((match) => <li key={`${match.sourceSong}-${match.matchedSong}`}><span>{match.sourceSong}</span><b>→</b><span>{match.matchedSong} <small>({match.strategy === 'manual' ? 'manuell' : `${match.confidence} %`})</small></span></li>)}</ul></details>}
                  {juror.missingSongs.length > 0 && <ul className="ks-import-missing">{juror.missingSongs.map((song) => {
                    const songKey = `${round.sheet}:${song.sourceSong}:song`;
                    const suggestion = song.suggestions.find((entry) => Boolean(entry.id)) || song.suggestions[0];
                    return <li key={song.sourceSong}><strong>{song.sourceSong}</strong>{suggestion && <div className="ks-import-suggestions" aria-label="Automatischer Songvorschlag"><div><span><small>{suggestion.id ? 'Vorgeschlagene Zuordnung' : 'Hinweis'}</small><b>{suggestion.label}</b></span>{suggestion.id && <button className="ks-button secondary small" type="button" disabled={Boolean(savingKey)} onClick={() => void saveMapping({ mappingType: 'song', sheet: round.sheet, sourceSong: song.sourceSong, value: suggestion.id }, songKey)}>{savingKey === songKey ? 'Wird übernommen …' : 'Ja, diesen Song nehmen'}</button>}</div></div>}
                      <label><span>Zuordnen zu</span><select value={song.mappingValue} disabled={Boolean(savingKey)} onChange={(event) => void saveMapping({ mappingType: 'song', sheet: round.sheet, sourceSong: song.sourceSong, value: event.target.value }, songKey)}>
                        <option value="">Bitte Song auswählen …</option>{round.songOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select></label>{savingKey === songKey && <small>Wird gespeichert …</small>}</li>;
                  })}</ul>}
                </article>;
              })}
            </div>
            {round.skippedColumns.length > 0 && <div className="ks-import-source-errors"><h3>Fehlerhafte oder leere Excel-Spalten</h3>{round.skippedColumns.map((column) => {
              const ignoreKey = `${round.sheet}:${column.sourceName}:ignore`;
              return <article key={`${round.sheet}-${column.sourceName}`} className={column.corrected ? 'resolved' : column.ignored ? 'ignored' : ''}>
                <header><strong>{column.displayName}</strong><span><CategoryBadge category={column.category} /><span className={`ks-status-badge ${column.corrected ? 'success' : column.ignored ? 'neutral' : 'danger'}`}>{column.corrected ? 'Korrigiert' : column.ignored ? 'Ignoriert' : 'Datenfehler'}</span></span></header>
                <p>{column.reason}. {column.rankingCount} Einträge, Summe {column.sum}{column.missingPoints.length ? `, fehlend: ${column.missingPoints.join(', ')}` : ''}{column.duplicatePoints.length ? `, doppelt: ${column.duplicatePoints.map((point) => `${point.point} (${point.count}×)`).join(', ')}` : ''}</p>
                {column.rankingCount > 0 && !column.ignored && <RankingCorrection round={round} column={column} busy={Boolean(savingKey)} onSave={saveMapping} />}
                <button className="ks-button secondary small" type="button" disabled={Boolean(savingKey)} onClick={() => void saveMapping({ mappingType: 'juror', sheet: round.sheet, sourceName: column.sourceName, value: column.ignored ? AUTO : IGNORE }, ignoreKey)}>{column.ignored ? 'Wieder bearbeiten' : 'Spalte bewusst ignorieren'}</button>
              </article>;
            })}</div>}
          </div>
        </details>;
      })}
    </section>
  </>;
}
