'use client';

import { useEffect, useMemo, useState } from 'react';

type Category = 'jury' | 'dj';
type MatchReview = { sourceSong: string; matchedSong: string; strategy: string; confidence: number };
type Suggestion = { id: string | null; label: string; confidence: number | null };
type JurorReport = {
  sourceName: string;
  displayName: string;
  category: Category;
  status: 'ready-new' | 'ready-existing' | 'already-imported' | 'blocked' | 'conflict' | 'ignored';
  message: string;
  matchedSongs: number;
  matchReviews: MatchReview[];
  missingSongs: Array<{ sourceSong: string; suggestions: Suggestion[]; mappingValue: string }>;
  jurorMappingValue: string;
  suggestedJuror: { id: string; displayName: string; confidence: number } | null;
  ignoredReason: string;
};
type RankingItem = { songLabel: string; points: number };
type SkippedColumn = {
  sourceName: string;
  displayName: string;
  category: Category;
  kind: 'empty' | 'ranking-error' | 'dj-aggregate';
  reason: string;
  rankingCount: number;
  sum: number;
  missingPoints: number[];
  duplicatePoints: Array<{ point: number; count: number }>;
  nonRankingNumbers: number[];
  ranking: RankingItem[];
  currentRanking: RankingItem[];
  corrected: boolean;
  ignored: boolean;
  ignoredReason: string;
};
type RoundTarget = { id: string; title: string; slug: string; songsCount: number; audienceVotes: number };
type RoundReport = {
  sheet: string;
  votingDate: string;
  sourceSongs: number;
  targetRound: RoundTarget | null;
  suggestedRound: (RoundTarget & { confidence: number }) | null;
  roundMappingValue: string;
  status: 'ready' | 'partial' | 'blocked' | 'complete';
  jurors: JurorReport[];
  skippedColumns: SkippedColumn[];
  zonkEntries: number;
  songOptions: Array<{ id: string; label: string }>;
  jurorOptions: Array<{ id: string; displayName: string; category: Category }>;
  canCreateRound: boolean;
  sourceSongCatalogCount: number;
};
type ImportReport = {
  sourceFile: string;
  generatedAt: string;
  roundOptions: Array<{ id: string; title: string; slug: string; period: string; songsCount: number; audienceVotes: number }>;
  summary: {
    foundVotes: number;
    safeVotes: number;
    reviewVotes: number;
    errorVotes: number;
    openProblems: number;
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
    aggregateDjColumns: number;
  };
  rounds: RoundReport[];
};

type Filter = 'all' | 'open' | 'round' | 'song' | 'juror' | 'points' | 'data';
type ProblemKind = Exclude<Filter, 'all' | 'open'>;
type Problem = { id: string; sheet: string; kind: ProblemKind; label: string };

const AUTO = '__auto__';
const NEW = '__new__';
const IGNORE = '__ignore__';

const jurorLabels: Record<JurorReport['status'], string> = {
  'ready-new': 'Sicher · neu importierbar',
  'ready-existing': 'Sicher · Wertung ergänzen',
  'already-imported': 'Bereits importiert',
  blocked: 'Bitte prüfen',
  conflict: 'Import nicht möglich',
  ignored: 'Bewusst nicht übernommen',
};

function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('de-DE').format(date);
}

function numberLabel(value: number) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value);
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

function anchor(kind: ProblemKind, sheet: string, source = '') {
  return `import-${kind}-${encodeURIComponent(sheet)}-${encodeURIComponent(source)}`;
}

function collectProblems(report: ImportReport): Problem[] {
  return report.rounds.flatMap((round) => {
    const problems: Problem[] = [];
    if (!round.targetRound) problems.push({ id: anchor('round', round.sheet), sheet: round.sheet, kind: 'round', label: `${dateLabel(round.votingDate)}: Umfrage zuordnen` });
    for (const juror of round.jurors) {
      if (juror.status === 'conflict') problems.push({ id: anchor('data', round.sheet, juror.sourceName), sheet: round.sheet, kind: 'data', label: `${dateLabel(round.votingDate)}: ${juror.displayName}` });
      else if (juror.status === 'blocked' && round.targetRound) {
        const kind: ProblemKind = juror.missingSongs.length ? 'song' : juror.suggestedJuror ? 'juror' : 'data';
        problems.push({ id: anchor(kind, round.sheet, juror.sourceName), sheet: round.sheet, kind, label: `${dateLabel(round.votingDate)}: ${juror.displayName}` });
      }
    }
    for (const column of round.skippedColumns) {
      if (column.kind === 'ranking-error' && !column.corrected && !column.ignored) {
        problems.push({ id: anchor('points', round.sheet, column.sourceName), sheet: round.sheet, kind: 'points', label: `${dateLabel(round.votingDate)}: ${column.displayName}` });
      }
    }
    return problems;
  });
}

function RankingCorrection({ round, column, busy, onSaveAndImport, onRemove }: {
  round: RoundReport;
  column: SkippedColumn;
  busy: boolean;
  onSaveAndImport: (ranking: RankingItem[], key: string) => Promise<void>;
  onRemove: (key: string) => Promise<void>;
}) {
  const [ranking, setRanking] = useState(column.currentRanking);
  useEffect(() => { setRanking(column.currentRanking); }, [column.currentRanking]);

  const active = ranking.map((item, index) => ({ ...item, index })).filter((item) => Number(item.points) > 0);
  const integerRows = active.filter((item) => Number.isInteger(item.points) && item.points >= 1 && item.points <= 12);
  const invalidRows = active.filter((item) => !Number.isInteger(item.points) || item.points < 1 || item.points > 12);
  const counts = new Map<number, typeof active>();
  for (const item of active) counts.set(item.points, [...(counts.get(item.points) || []), item]);
  const duplicateGroups = [...counts.entries()].filter(([, rows]) => rows.length > 1).sort((a, b) => b[0] - a[0]);
  const missing = Array.from({ length: 12 }, (_, index) => index + 1).filter((point) => !integerRows.some((item) => item.points === point));
  const uniqueSongs = new Set(active.map((item) => item.songLabel)).size;
  const isValid = active.length === 12 && uniqueSongs === 12 && invalidRows.length === 0 && duplicateGroups.length === 0 && missing.length === 0;
  const suggestion = invalidRows.length === 1 && missing.length === 1 && duplicateGroups.length === 0 && active.length === 12
    ? { index: invalidRows[0].index, point: missing[0], songLabel: invalidRows[0].songLabel }
    : null;
  const key = `${round.sheet}:${column.sourceName}:ranking`;
  const originalBySong = new Map(column.ranking.map((item) => [item.songLabel, item.points]));

  function changePoint(index: number, points: number) {
    setRanking((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, points } : row));
  }

  return <div className="ks-import-correction">
    <div className="ks-import-diagnosis">
      <div><span className="ks-section-kicker">Problem</span><h4>Punktevergabe ist nicht eindeutig</h4><p>Für eine einzelne Jurywertung müssen die Punkte 1 bis 12 jeweils genau einmal vergeben werden.</p></div>
      <ul className="ks-import-checklist">
        <li className={active.length === 12 ? 'ok' : 'bad'}>{active.length === 12 ? '✓' : '✕'} {active.length} von 12 benötigten Songs aktiv{ranking.length > 12 ? ` · ${ranking.length} Excel-Zeilen vorhanden` : ''}</li>
        <li className={duplicateGroups.length === 0 ? 'ok' : 'bad'}>{duplicateGroups.length === 0 ? '✓ Keine' : `✕ ${duplicateGroups.length}`} doppelt vergebenen Punktzahlen</li>
        <li className={missing.length === 0 ? 'ok' : 'bad'}>{missing.length === 0 ? '✓ Keine' : `✕ ${missing.length}`} fehlenden Punktzahlen</li>
        <li className={invalidRows.length === 0 ? 'ok' : 'bad'}>{invalidRows.length === 0 ? '✓ Keine' : `✕ ${invalidRows.length}`} ungültigen Excel-Werte</li>
      </ul>
      {ranking.length > 12 && <div className="ks-import-explanation warning"><strong>Zu viele Einträge</strong><span>Excel enthält {ranking.length} Zeilen mit Werten. Für diese Abstimmung dürfen genau 12 Songs aktiv bleiben. Setze deshalb eine Zeile auf „Nicht übernehmen“.</span></div>}
      {duplicateGroups.length > 0 && <div className="ks-import-diagnostic-list"><strong>Doppelt vergeben</strong>{duplicateGroups.map(([point, rows]) => <div key={point}><b>{numberLabel(point)} Punkte · {rows.length}×</b><ul>{rows.map((row) => <li key={`${row.songLabel}-${row.index}`}>{row.songLabel}</li>)}</ul></div>)}</div>}
      {missing.length > 0 && <div className="ks-import-explanation danger"><strong>Fehlende Punktzahlen</strong><span>{missing.join(' · ')}</span></div>}
      {invalidRows.length > 0 && <div className="ks-import-diagnostic-list danger"><strong>Ungültige Originalwerte</strong>{invalidRows.map((row) => <div key={`${row.songLabel}-${row.index}`}><b>{row.songLabel}</b><span>Excel enthält {numberLabel(originalBySong.get(row.songLabel) ?? row.points)} Punkte. Dezimalwerte oder Werte außerhalb 1–12 sind für eine einzelne Jurywertung nicht zulässig.</span></div>)}</div>}
      <div className="ks-import-explanation"><strong>Was du jetzt tun musst</strong><span>Ändere nur die rot markierten Werte. Am Ende müssen genau 12 Songs aktiv sein und 1 bis 12 jeweils einmal vorkommen. Der ursprüngliche Excel-Wert bleibt bei jeder Zeile sichtbar.</span></div>
      {suggestion ? <div className="ks-import-suggestion-callout"><span><strong>Mathematisch eindeutiger Vorschlag</strong>{suggestion.songLabel}: {numberLabel(ranking[suggestion.index].points)} → {suggestion.point} Punkte</span><button className="ks-button secondary small" type="button" onClick={() => changePoint(suggestion.index, suggestion.point)}>{suggestion.point} übernehmen</button></div>
        : !isValid && <small>Keine eindeutige automatische Korrektur möglich. Es wird nichts ohne deine Bestätigung verändert.</small>}
    </div>

    <div className="ks-import-ranking-grid">
      {ranking.map((item, index) => {
        const duplicateCount = counts.get(item.points)?.length || 0;
        const invalid = item.points > 0 && (!Number.isInteger(item.points) || item.points < 1 || item.points > 12);
        const problematic = invalid || (item.points > 0 && duplicateCount > 1);
        const original = originalBySong.get(item.songLabel) ?? item.points;
        return <label className={problematic ? 'problem' : item.points > 0 ? 'valid' : 'excluded'} key={`${item.songLabel}-${index}`}>
          <span className="ks-import-ranking-song"><strong>{item.songLabel}</strong><small>Excel: {numberLabel(original)}{item.points !== original ? ` · Importwert: ${item.points > 0 ? numberLabel(item.points) : 'Nicht übernehmen'}` : ''}</small></span>
          <span className="ks-import-ranking-input"><select value={String(item.points)} onChange={(event) => changePoint(index, Number(event.target.value))}>
            {!Number.isInteger(item.points) && <option value={String(item.points)}>{numberLabel(item.points)} (Excel · ungültig)</option>}
            <option value="0">Nicht übernehmen</option>
            {Array.from({ length: 12 }, (_, pointIndex) => 12 - pointIndex).map((point) => <option key={point} value={point}>{point} Punkte</option>)}
          </select>
          {problematic ? <small className="bad">⚠ {invalid ? `${numberLabel(item.points)} ist nicht zulässig` : `${numberLabel(item.points)} Punkte sind ${duplicateCount}× vergeben`}</small>
            : item.points > 0 ? <small className="ok">✓ {item.points} Punkte eindeutig</small> : <small>Nicht übernehmen</small>}</span>
        </label>;
      })}
    </div>
    <div className="ks-inline-actions">
      <button className="ks-button primary small" type="button" disabled={busy || !isValid} onClick={() => void onSaveAndImport(ranking, key)}>Korrektur speichern, importieren &amp; weiter</button>
      {column.corrected && <button className="ks-button secondary small" type="button" disabled={busy} onClick={() => void onRemove(key)}>Gespeicherte Korrektur entfernen</button>}
      <span className={`ks-import-validation ${isValid ? 'valid' : ''}`}>{isValid ? '✓ Alle Punktzahlen 1–12 sind eindeutig vergeben.' : 'Noch nicht importierbar'}</span>
    </div>
  </div>;
}

function IgnoreControl({ ignored, reason, busy, label, onChange }: {
  ignored: boolean;
  reason: string;
  busy: boolean;
  label: string;
  onChange: (ignored: boolean, reason: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(reason);
  useEffect(() => { setNote(reason); }, [reason]);
  if (ignored) return <div className="ks-import-ignore-state"><span><strong>Bewusst nicht übernommen</strong>{reason ? ` · Grund: ${reason}` : ''}</span><button className="ks-button secondary small" type="button" disabled={busy} onClick={() => void onChange(false, '')}>Entscheidung rückgängig machen</button></div>;
  if (!editing) return <button className="ks-button ghost small" type="button" disabled={busy} onClick={() => setEditing(true)}>{label}</button>;
  return <div className="ks-import-ignore-confirm"><strong>Diese historische Wertung wird nicht importiert.</strong><label><span>Grund (optional)</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="z. B. Spalte war nur eine interne Berechnung" /></label><div className="ks-inline-actions"><button className="ks-button danger small" type="button" disabled={busy} onClick={() => void onChange(true, note)}>Wirklich nicht übernehmen</button><button className="ks-button secondary small" type="button" disabled={busy} onClick={() => setEditing(false)}>Abbrechen</button></div></div>;
}

export default function HistoricalJuryImportPanel() {
  const [report, setReport] = useState<ImportReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [activeProblemId, setActiveProblemId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadReport() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/historical-jury-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'dry-run' }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Dry-Run fehlgeschlagen.');
      setReport(payload.report);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Dry-Run fehlgeschlagen.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadReport(); }, []);

  const problems = useMemo(() => report ? collectProblems(report) : [], [report]);
  const filteredProblems = useMemo(() => problems.filter((problem) => filter === 'all' || filter === 'open' || problem.kind === filter), [filter, problems]);

  useEffect(() => {
    if (activeProblemId && !filteredProblems.some((problem) => problem.id === activeProblemId)) setActiveProblemId(filteredProblems[0]?.id || '');
  }, [activeProblemId, filteredProblems]);

  function scrollToProblem(id: string) {
    if (!id) return;
    setActiveProblemId(id);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })));
  }

  function moveProblem(direction: -1 | 1) {
    if (!filteredProblems.length) return;
    const currentFound = filteredProblems.findIndex((problem) => problem.id === activeProblemId);
    const current = currentFound < 0 ? 0 : currentFound;
    const next = (current + direction + filteredProblems.length) % filteredProblems.length;
    scrollToProblem(filteredProblems[next].id);
  }

  function advanceAfterUpdate(previousId: string, nextReport: ImportReport) {
    const nextProblems = collectProblems(nextReport).filter((problem) => filter === 'all' || filter === 'open' || problem.kind === filter);
    if (!nextProblems.length) { setActiveProblemId(''); return; }
    const previousIndex = Math.max(0, filteredProblems.findIndex((problem) => problem.id === previousId));
    const target = nextProblems[Math.min(previousIndex, nextProblems.length - 1)];
    window.setTimeout(() => scrollToProblem(target.id), 80);
  }

  async function saveMapping(payload: Record<string, unknown>, key: string, success = 'Zuordnung gespeichert und neu geprüft.') {
    setSavingKey(key);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/historical-jury-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-mapping', ...payload }) });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Zuordnung konnte nicht gespeichert werden.');
      setReport(data.report);
      setMessage(success);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Zuordnung konnte nicht gespeichert werden.');
    } finally { setSavingKey(''); }
  }

  async function runRepairAction(action: 'create-round' | 'create-song', payload: Record<string, unknown>, key: string, success: string) {
    setSavingKey(key);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/historical-jury-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Historische Daten konnten nicht ergänzt werden.');
      setReport(data.report);
      setMessage(success);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Historische Daten konnten nicht ergänzt werden.');
    } finally { setSavingKey(''); }
  }

  async function saveRankingAndImport(round: RoundReport, column: SkippedColumn, ranking: RankingItem[], key: string) {
    setSavingKey(key);
    setError('');
    setMessage('');
    let saved = false;
    try {
      const saveResponse = await fetch('/api/admin/historical-jury-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-mapping', mappingType: 'ranking', sheet: round.sheet, sourceName: column.sourceName, ranking }) });
      const saveData = await saveResponse.json();
      if (!saveResponse.ok || !saveData.ok) throw new Error(saveData.error || 'Korrektur konnte nicht gespeichert werden.');
      saved = true;
      setReport(saveData.report);
      const importResponse = await fetch('/api/admin/historical-jury-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'apply-one', sheet: round.sheet, sourceName: column.sourceName }) });
      const importData = await importResponse.json();
      if (!importResponse.ok || !importData.ok) throw new Error(importData.error || 'Korrektur gespeichert, aber die Wertung konnte noch nicht importiert werden.');
      setReport(importData.report);
      setMessage(importData.importedVotes > 0 ? '✓ Korrektur gespeichert und Jurywertung importiert.' : '✓ Diese Wertung war bereits identisch importiert.');
      advanceAfterUpdate(anchor('points', round.sheet, column.sourceName), importData.report);
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : 'Aktion fehlgeschlagen.';
      setError(saved ? `Die Korrektur ist gespeichert. Der Import ist noch offen: ${detail}` : detail);
    } finally { setSavingKey(''); }
  }

  async function applyImport() {
    if (!report || report.summary.safeVotes < 1) return;
    if (!window.confirm(`${report.summary.safeVotes} sichere Wertungen jetzt importieren? Offene Fälle und bestehende Daten bleiben unverändert.`)) return;
    setApplying(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/historical-jury-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'apply' }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Import fehlgeschlagen.');
      setReport(payload.report);
      setMessage(`✓ ${payload.importedJuryVotes} Jurywertungen und ${payload.importedDjVotes} separate DJ-Wertungen importiert. Bereits vorhandene Wertungen wurden nicht dupliziert.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Import fehlgeschlagen.');
    } finally { setApplying(false); }
  }

  if (loading) return <section className="ks-card ks-import-loading" aria-live="polite"><strong>Historische Daten werden geprüft …</strong><p>Runden, Songs und vorhandene Wertungen werden nur gelesen. Es wird noch nichts importiert.</p></section>;
  if (!report) return <section className="notice error" role="alert"><strong>Der Import-Dry-Run konnte nicht erstellt werden.</strong><span>{error}</span><button className="ks-button secondary" type="button" onClick={() => void loadReport()}>Erneut prüfen</button></section>;

  const summary = report.summary;
  const currentProblemIndex = Math.max(0, filteredProblems.findIndex((problem) => problem.id === activeProblemId));
  const visibleRounds = report.rounds.filter((round) => filter === 'all' || filteredProblems.some((problem) => problem.sheet === round.sheet));

  return <>
    {message && <div className="notice success" role="status"><strong>Aktualisiert</strong><span>{message}</span></div>}
    {error && <div className="notice error" role="alert"><strong>Aktion nicht vollständig durchgeführt</strong><span>{error}</span></div>}

    <section className="ks-card ks-import-overview">
      <div><span className="ks-section-kicker">Einmaliger Datenimport</span><h2>Historische Jurywertungen</h2><p>{summary.foundVotes} Wertungen/Quellspalten gefunden. Sichere Datensätze können sofort importiert werden; offene Fälle bleiben einzeln bearbeitbar.</p></div>
      <div className="ks-import-overview-counts"><span className="neutral"><strong>{summary.foundVotes}</strong> gefunden</span><span className="success"><strong>{summary.safeVotes}</strong> sicher</span><span className="warning"><strong>{summary.reviewVotes}</strong> prüfen</span><span className="danger"><strong>{summary.errorVotes}</strong> Fehler</span><span className="neutral"><strong>{summary.alreadyImportedVotes}</strong> bereits importiert</span></div>
      {summary.openProblems === 0 && summary.safeVotes === 0
        ? <div className="notice success"><strong>✓ Historischer Jury-Import abgeschlossen</strong><span>{summary.alreadyImportedVotes} importiert · {summary.ignoredVotes} bewusst nicht übernommen · 0 offen</span></div>
        : <div className="ks-import-primary-action"><div><strong>{summary.safeVotes} Wertungen können ohne weitere Prüfung importiert werden.</strong><small>{summary.openProblems} offene Probleme bleiben anschließend in der Arbeitsliste.</small></div><button className="ks-button primary" type="button" disabled={applying || summary.safeVotes < 1} onClick={() => void applyImport()}>{applying ? 'Import läuft …' : 'Alle sicheren Wertungen jetzt importieren'}</button></div>}
    </section>

    <section className="ks-card ks-import-safety"><div><h2>Sicherer Teilimport</h2><p>Importiert wird nur, was formal gültig und eindeutig bestätigt ist. Identische vorhandene Wertungen werden erkannt; abweichende bestehende Wertungen werden niemals überschrieben.</p></div><ul><li>Wochen-, Song-, Juror- und Punkte-Korrekturen bleiben dauerhaft in den vorhandenen App-Einstellungen gespeichert.</li><li>Ein Fehler bei einem Juror blockiert nicht die vier korrekten Wertungen derselben Woche.</li><li>{summary.aggregateDjColumns} aggregierte DJ-Gesamtwertungen werden als separate Quelldaten erkannt und nicht zur Jury- oder Publikumsgesamtwertung addiert.</li><li>{summary.zonkEntriesNotImported} historische Jury-ZONKs bleiben unberührt, weil das aktuelle Jury-Schema dafür kein Zielfeld besitzt.</li></ul></section>

    <section className="ks-card ks-import-worklist">
      <div className="ks-section-heading"><div><span className="ks-section-kicker">Arbeitsliste</span><h2>Offene Probleme</h2><p>Noch {summary.openProblems} offene Probleme. Wähle eine Kategorie oder arbeite sie nacheinander ab.</p></div><button className="ks-button secondary small" type="button" disabled={applying || Boolean(savingKey)} onClick={() => void loadReport()}>Neu prüfen</button></div>
      <div className="ks-import-filters" role="group" aria-label="Importprobleme filtern">{([['all', 'Alle'], ['open', 'Nur offene'], ['round', 'Umfrage-Zuordnung'], ['song', 'Song-Zuordnung'], ['juror', 'Juror-Zuordnung'], ['points', 'Punktefehler'], ['data', 'Datenfehler']] as Array<[Filter, string]>).map(([value, label]) => <button className={filter === value ? 'active' : ''} key={value} type="button" onClick={() => { setFilter(value); setActiveProblemId(''); }}>{label}</button>)}</div>
      {filter !== 'all' && <div className="ks-import-problem-nav"><button className="ks-button secondary small" type="button" disabled={!filteredProblems.length} onClick={() => moveProblem(-1)}>← Vorheriges Problem</button><span>{filteredProblems.length ? `${currentProblemIndex + 1} von ${filteredProblems.length}` : 'Keine Probleme in diesem Filter'}</span><button className="ks-button secondary small" type="button" disabled={!filteredProblems.length} onClick={() => moveProblem(1)}>Nächstes Problem →</button></div>}
    </section>

    <section className="ks-import-rounds">
      {visibleRounds.map((round) => {
        const roundProblems = filteredProblems.filter((problem) => problem.sheet === round.sheet);
        const needsAttention = roundProblems.length > 0;
        const roundKey = `${round.sheet}:round`;
        const showRoundMapping = filter === 'all' || !round.targetRound || filter === 'round' || filter === 'open';
        const visibleJurors = round.jurors.filter((juror) => {
          if (filter === 'all') return true;
          if (!round.targetRound) return false;
          if (filter === 'open') return juror.status === 'blocked' || juror.status === 'conflict';
          if (filter === 'song') return juror.missingSongs.length > 0;
          if (filter === 'juror') return juror.suggestedJuror != null;
          if (filter === 'data') return juror.status === 'conflict' || (juror.status === 'blocked' && !juror.missingSongs.length && !juror.suggestedJuror);
          return false;
        });
        const visibleColumns = round.skippedColumns.filter((column) => filter === 'all' || ((filter === 'open' || filter === 'points') && column.kind === 'ranking-error' && !column.corrected && !column.ignored));
        return <details className="ks-card" key={round.sheet} open={needsAttention || filter !== 'all'}>
          <summary><span><strong>{dateLabel(round.votingDate)}</strong><small>{round.targetRound ? `${round.targetRound.title} · ${round.targetRound.audienceVotes} Publikumsstimmen` : 'Umfrage noch nicht eindeutig zugeordnet'}</small></span><span className={`ks-status-badge ${statusTone(round.status)}`}>{round.status === 'complete' ? 'Erledigt' : round.status === 'ready' ? 'Sicher importierbar' : round.status === 'partial' ? 'Teilweise importierbar' : 'Prüfung nötig'}</span></summary>
          <div className="ks-import-round-body">
            {showRoundMapping && <div className={`ks-import-round-mapping ${!round.targetRound ? 'needs-attention' : ''}`} id={!round.targetRound ? anchor('round', round.sheet) : undefined}><div><span className="ks-section-kicker">Wochen-Zuordnung</span><strong>{round.targetRound ? `Automatisch erkannt: ${round.targetRound.title}` : 'Umfrage nicht eindeutig erkannt'}</strong><small>Historische Excel-Daten: {dateLabel(round.votingDate)} · {round.sourceSongs} Songs</small></div>{!round.targetRound && round.suggestedRound && <div className="ks-import-round-suggestion"><span><small>Vermutlicher Treffer · {round.suggestedRound.confidence} %</small><b>{round.suggestedRound.title}</b><small>{round.suggestedRound.songsCount} Songs · {round.suggestedRound.audienceVotes} Publikumsstimmen</small></span><button className="ks-button primary small" type="button" disabled={Boolean(savingKey)} onClick={() => void saveMapping({ mappingType: 'round', sheet: round.sheet, value: round.suggestedRound!.id }, roundKey, '✓ Wochenzuordnung gespeichert. Alle Wertungen dieser Woche wurden neu geprüft.')}>Ja, diese Umfrage verwenden</button></div>}<label><span>{round.targetRound ? 'Zuordnung ändern' : 'Andere Umfrage auswählen'}</span><select value={round.roundMappingValue} disabled={Boolean(savingKey)} onChange={(event) => void saveMapping({ mappingType: 'round', sheet: round.sheet, value: event.target.value }, roundKey)}><option value="">Automatisch anhand Datum und Songs erkennen</option>{report.roundOptions.map((option) => <option key={option.id} value={option.id}>{option.period} · {option.title} · {option.songsCount} Songs · {option.audienceVotes} Publikumsstimmen · {option.slug}</option>)}</select></label>{!round.targetRound && !round.suggestedRound && round.canCreateRound && <div className="ks-import-create-source"><div><strong>Diese historische Woche fehlt offenbar noch.</strong><small>Der Importer kann eine abgeschlossene, nicht öffentliche Umfrage mit allen {round.sourceSongCatalogCount} Excel-Songs anlegen. Danach werden die Jurywertungen normal geprüft.</small></div><button className="ks-button secondary small" type="button" disabled={Boolean(savingKey)} onClick={() => { if (!window.confirm(`Historische Umfrage für den ${dateLabel(round.votingDate)} mit ${round.sourceSongCatalogCount} Excel-Songs neu anlegen?`)) return; void runRepairAction('create-round', { sheet: round.sheet }, `${roundKey}:create`, '✓ Historische Umfrage und vollständige Songliste angelegt. Die Jurywertungen wurden neu geprüft.'); }}>{savingKey === `${roundKey}:create` ? 'Wird angelegt …' : 'Historische Umfrage aus Excel anlegen'}</button></div>}</div>}
            <p className="ks-import-source-note">Excel: {round.sourceSongs} Songs · {round.jurors.length} formal gültige Wertungen · {round.zonkEntries} Jury-ZONKs ohne Zielfeld</p>

            {visibleJurors.length > 0 && <div className="ks-import-jurors">{visibleJurors.map((juror) => {
              const kind: ProblemKind = juror.status === 'conflict' ? 'data' : juror.missingSongs.length ? 'song' : juror.suggestedJuror ? 'juror' : 'data';
              const jurorKey = `${round.sheet}:${juror.sourceName}:juror`;
              return <article id={(juror.status === 'blocked' || juror.status === 'conflict') ? anchor(kind, round.sheet, juror.sourceName) : undefined} key={`${round.sheet}-${juror.sourceName}-${juror.category}`} className={juror.status === 'conflict' ? 'error' : juror.status === 'blocked' ? 'review' : juror.status === 'already-imported' ? 'done' : 'ready'}><header><div><strong>{juror.displayName}</strong><small>Excel-Spalte: {juror.sourceName}</small></div><span><CategoryBadge category={juror.category} /><span className={`ks-status-badge ${statusTone(juror.status)}`}>{jurorLabels[juror.status]}</span></span></header><p>{juror.message} · {juror.matchedSongs}/12 Songs eindeutig</p>{juror.suggestedJuror && <div className="ks-import-suggestions"><div><span><small>Vermutlicher Juror · {juror.suggestedJuror.confidence} %</small><b>{juror.suggestedJuror.displayName}</b></span><button className="ks-button secondary small" type="button" disabled={Boolean(savingKey)} onClick={() => void saveMapping({ mappingType: 'juror', sheet: round.sheet, sourceName: juror.sourceName, value: juror.suggestedJuror!.id }, jurorKey, '✓ Juror-Zuordnung bestätigt und gespeichert.')}>Ja, verwenden</button></div></div>}{round.targetRound && <label className="ks-import-compact-select"><span>{juror.suggestedJuror ? 'Anderen Juror auswählen' : 'Juror-Zuordnung'}</span><select value={juror.jurorMappingValue} disabled={Boolean(savingKey)} onChange={(event) => void saveMapping({ mappingType: 'juror', sheet: round.sheet, sourceName: juror.sourceName, value: event.target.value }, jurorKey)}><option value={AUTO}>Automatisch nach Namen</option><option value={NEW}>Neue {juror.category === 'dj' ? 'DJ-Kategorie' : 'Jury-Zuordnung'} anlegen</option>{round.jurorOptions.filter((option) => option.category === juror.category).map((option) => <option key={option.id} value={option.id}>Vorhanden: {option.displayName}</option>)}</select></label>}{juror.matchReviews.length > 0 && <details className="ks-import-review"><summary>{juror.matchReviews.length} bestätigte Song-Zuordnungen</summary><ul>{juror.matchReviews.map((match) => <li key={`${match.sourceSong}-${match.matchedSong}`}><span>{match.sourceSong}</span><b>→</b><span>{match.matchedSong} <small>(bestätigt)</small></span></li>)}</ul></details>}{juror.missingSongs.length > 0 && <ul className="ks-import-missing">{juror.missingSongs.map((song) => {
                const songKey = `${round.sheet}:${song.sourceSong}:song`;
                const suggestion = song.suggestions.find((entry) => Boolean(entry.id)) || song.suggestions[0];
                return <li key={song.sourceSong}><span className="ks-section-kicker">Historischer Excel-Eintrag</span><strong>{song.sourceSong}</strong>{suggestion && <div className="ks-import-suggestions"><div><span><small>{suggestion.id ? `Vermutlicher Treffer${suggestion.confidence != null ? ` · ${suggestion.confidence} %` : ''}` : 'Hinweis'}</small><b>{suggestion.label}</b></span>{suggestion.id && <button className="ks-button secondary small" type="button" disabled={Boolean(savingKey)} onClick={() => void saveMapping({ mappingType: 'song', sheet: round.sheet, sourceSong: song.sourceSong, value: suggestion.id }, songKey, '✓ Song-Zuordnung bestätigt und dauerhaft gespeichert.')}>{savingKey === songKey ? 'Wird gespeichert …' : 'Ja, diesen Song verwenden'}</button>}</div></div>}{!suggestion && <div className="ks-import-create-source compact"><div><strong>Kein passender Song in dieser Umfrage gefunden.</strong><small>Nur verwenden, wenn der Song in der Zielumfrage tatsächlich fehlt.</small></div><button className="ks-button secondary small" type="button" disabled={Boolean(savingKey)} onClick={() => { if (!window.confirm(`„${song.sourceSong}“ als neuen Song in dieser historischen Umfrage anlegen?`)) return; void runRepairAction('create-song', { sheet: round.sheet, sourceSong: song.sourceSong }, `${songKey}:create`, '✓ Fehlenden historischen Song angelegt und dauerhaft zugeordnet.'); }}>{savingKey === `${songKey}:create` ? 'Wird angelegt …' : 'Excel-Song neu anlegen'}</button></div>}<label><span>Anderen Song auswählen</span><select value={song.mappingValue} disabled={Boolean(savingKey)} onChange={(event) => { const value = event.target.value; if (value === IGNORE && !window.confirm('Diesen Excel-Song wirklich nicht übernehmen? Die Jurywertung bleibt unvollständig, falls danach weniger als 12 Songs übrig sind.')) return; void saveMapping({ mappingType: 'song', sheet: round.sheet, sourceSong: song.sourceSong, value }, songKey); }}><option value="">Bitte Song auswählen …</option>{round.songOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}<option value={IGNORE}>Nicht übernehmen</option></select></label></li>;
              })}</ul>}<IgnoreControl ignored={juror.status === 'ignored'} reason={juror.ignoredReason} busy={Boolean(savingKey)} label="Diese komplette Wertung nicht übernehmen …" onChange={(ignored, reason) => saveMapping({ mappingType: 'juror', sheet: round.sheet, sourceName: juror.sourceName, value: ignored ? IGNORE : AUTO, reason }, `${jurorKey}:ignore`)} /></article>;
            })}</div>}

            {visibleColumns.length > 0 && <div className="ks-import-source-errors"><h3>Excel-Spalten mit besonderem Status</h3>{visibleColumns.map((column) => {
              const ignoreKey = `${round.sheet}:${column.sourceName}:ignore`;
              if (column.kind === 'dj-aggregate') return <article className="aggregate" key={`${round.sheet}-${column.sourceName}`}><header><strong>{column.displayName}</strong><span><CategoryBadge category={column.category} /><span className="ks-status-badge success">Separat erkannt</span></span></header><div className="ks-import-explanation violet"><strong>Keine fehlerhafte Jury-Stimme</strong><span>Diese Excel-Spalte ist eine zusammengefasste DJ-Auswertung. Gleichstände und Dezimalwerte wie 8,5 sind hier zulässige Originalwerte. Sie werden nicht gerundet und nicht in Jury, Publikum oder Gesamtwertung eingerechnet.</span></div><div className="ks-table-scroll"><table className="ks-table compact"><thead><tr><th>Song aus Excel</th><th>Originalwert</th></tr></thead><tbody>{[...column.ranking].sort((a, b) => b.points - a.points).map((item) => <tr key={item.songLabel}><td>{item.songLabel}</td><td><strong>{numberLabel(item.points)}</strong></td></tr>)}</tbody></table></div></article>;
              if (column.kind === 'empty') return <article className="empty" key={`${round.sheet}-${column.sourceName}`}><header><strong>{column.displayName}</strong><span><CategoryBadge category={column.category} /><span className="ks-status-badge neutral">Keine Wertung vorhanden</span></span></header><p>Die Excel-Spalte enthält keine abgegebene Top-12-Wertung. Es gibt hier nichts zu korrigieren oder zu importieren.</p></article>;
              return <article id={anchor('points', round.sheet, column.sourceName)} key={`${round.sheet}-${column.sourceName}`} className={column.corrected ? 'resolved' : column.ignored ? 'ignored' : 'ranking-error'}><header><strong>{column.displayName}</strong><span><CategoryBadge category={column.category} /><span className={`ks-status-badge ${column.corrected ? 'success' : column.ignored ? 'neutral' : 'warning'}`}>{column.corrected ? 'Korrektur gespeichert' : column.ignored ? 'Bewusst nicht übernommen' : 'Korrektur erforderlich'}</span></span></header>{!column.ignored && <RankingCorrection round={round} column={column} busy={Boolean(savingKey)} onSaveAndImport={(ranking, key) => saveRankingAndImport(round, column, ranking, key)} onRemove={(key) => saveMapping({ mappingType: 'ranking', sheet: round.sheet, sourceName: column.sourceName }, key, 'Gespeicherte Punkte-Korrektur entfernt.')} />}<IgnoreControl ignored={column.ignored} reason={column.ignoredReason} busy={Boolean(savingKey)} label="Diese komplette Excel-Spalte nicht übernehmen …" onChange={(ignored, reason) => saveMapping({ mappingType: 'juror', sheet: round.sheet, sourceName: column.sourceName, value: ignored ? IGNORE : AUTO, reason }, ignoreKey)} /></article>;
            })}</div>}
          </div>
        </details>;
      })}
      {!visibleRounds.length && <section className="ks-card ks-empty-state"><strong>✓ Keine offenen Fälle in diesem Filter</strong><p>Wechsle zu „Alle“, um bereits importierte und abgeschlossene Wochen als Protokoll zu sehen.</p></section>}
    </section>
  </>;
}
