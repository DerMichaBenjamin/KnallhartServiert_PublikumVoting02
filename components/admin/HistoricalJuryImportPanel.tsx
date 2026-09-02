'use client';

import { useEffect, useState } from 'react';

type MatchReview = { sourceSong: string; matchedSong: string; strategy: string; confidence: number };
type JurorReport = {
  sourceName: string;
  displayName: string;
  status: 'ready-new' | 'ready-existing' | 'already-imported' | 'blocked' | 'conflict';
  message: string;
  matchedSongs: number;
  matchReviews: MatchReview[];
  missingSongs: Array<{ sourceSong: string; suggestions: string[] }>;
};
type SkippedColumn = {
  sourceName: string;
  reason: string;
  rankingCount: number;
  sum: number;
  missingPoints: number[];
  duplicatePoints: Array<{ point: number; count: number }>;
};
type RoundReport = {
  sheet: string;
  votingDate: string;
  sourceSongs: number;
  targetRound: { id: string; title: string } | null;
  status: 'ready' | 'partial' | 'blocked' | 'complete';
  jurors: JurorReport[];
  skippedColumns: SkippedColumn[];
  zonkEntries: number;
};
type ImportReport = {
  sourceFile: string;
  generatedAt: string;
  summary: {
    sourceRounds: number;
    matchedRounds: number;
    validSourceVotes: number;
    readyVotes: number;
    alreadyImportedVotes: number;
    blockedVotes: number;
    conflictingVotes: number;
    skippedSourceColumns: number;
    invalidSourceVotes: number;
    emptySourceColumns: number;
    zonkEntriesNotImported: number;
    reviewedSongMatches: number;
  };
  rounds: RoundReport[];
};

const jurorLabels: Record<JurorReport['status'], string> = {
  'ready-new': 'Neu importierbar',
  'ready-existing': 'Wertung ergänzen',
  'already-imported': 'Bereits vorhanden',
  blocked: 'Zuordnung offen',
  conflict: 'Konflikt',
};

function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('de-DE').format(date);
}

function statusTone(status: JurorReport['status'] | RoundReport['status']) {
  if (status === 'ready' || status === 'ready-new' || status === 'ready-existing') return 'success';
  if (status === 'complete' || status === 'already-imported') return 'neutral';
  if (status === 'partial' || status === 'blocked') return 'warning';
  return 'danger';
}

export default function HistoricalJuryImportPanel() {
  const [report, setReport] = useState<ImportReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadReport() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/historical-jury-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dry-run' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Dry-Run fehlgeschlagen.');
      setReport(payload.report);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Dry-Run fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadReport(); }, []);

  async function applyImport() {
    if (!report || !confirmed || report.summary.readyVotes < 1) return;
    if (!window.confirm(`${report.summary.readyVotes} eindeutig zugeordnete Jurywertungen jetzt importieren? Bestehende abweichende Wertungen werden nicht überschrieben.`)) return;
    setApplying(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/historical-jury-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Import fehlgeschlagen.');
      setReport(payload.report);
      setConfirmed(false);
      setMessage(`${payload.importedVotes} Jurywertungen wurden importiert${payload.activatedJurors ? `; ${payload.activatedJurors} vorhandene Juroren wurden für die historische Auswertung aktiviert` : ''}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Import fehlgeschlagen.');
    } finally {
      setApplying(false);
    }
  }

  if (loading) return <section className="ks-card ks-import-loading" aria-live="polite"><strong>Historische Jury-Daten werden geprüft …</strong><p>Runden, Songs und bestehende Jurywertungen werden nur gelesen. Es wird noch nichts gespeichert.</p></section>;
  if (!report) return <section className="notice error" role="alert"><strong>Der Import-Dry-Run konnte nicht erstellt werden.</strong><span>{error}</span><button className="ks-button secondary" type="button" onClick={() => void loadReport()}>Erneut prüfen</button></section>;

  const summary = report.summary;
  return <>
    {message && <div className="notice success" role="status"><strong>Import abgeschlossen</strong><span>{message}</span><a href="/admin/statistics">Statistiken neu laden</a></div>}
    {error && <div className="notice error" role="alert"><strong>Import nicht durchgeführt</strong><span>{error}</span></div>}

    <section className="ks-stats-grid dashboard ks-import-summary" aria-label="Import-Zusammenfassung">
      <article className="ks-stat-card violet"><span>Excel-Wochen</span><strong>{summary.sourceRounds}</strong><small>{summary.matchedRounds} Datenbankrunden zugeordnet</small></article>
      <article className="ks-stat-card success"><span>Gültige Wertungen</span><strong>{summary.validSourceVotes}</strong><small>{summary.readyVotes} jetzt importierbar</small></article>
      <article className="ks-stat-card"><span>Bereits vorhanden</span><strong>{summary.alreadyImportedVotes}</strong><small>werden nicht doppelt angelegt</small></article>
      <article className="ks-stat-card warning"><span>Offene Zuordnungen</span><strong>{summary.blockedVotes}</strong><small>bleiben unverändert</small></article>
      <article className="ks-stat-card danger"><span>Bestehende Konflikte</span><strong>{summary.conflictingVotes}</strong><small>werden nie überschrieben</small></article>
      <article className="ks-stat-card warning"><span>Fehlerhafte Excel-Spalten</span><strong>{summary.invalidSourceVotes}</strong><small>plus {summary.emptySourceColumns} leere Spalte</small></article>
    </section>

    <section className="ks-card ks-import-safety">
      <div>
        <h2>Sicherer Import</h2>
        <p>Importiert werden ausschließlich vollständige Top-12-Listen mit den Punkten 12 bis 1 und eindeutiger Runden-, Song- und Jurorenzuordnung.</p>
      </div>
      <ul>
        <li>Bestehende identische Wertungen werden übersprungen.</li>
        <li>Bestehende abweichende Wertungen werden als Konflikt gemeldet und nicht verändert.</li>
        <li>{summary.reviewedSongMatches} verkürzte, umgedrehte oder sehr ähnliche Songbezeichnungen sind unten zur Kontrolle markiert.</li>
        <li>{summary.zonkEntriesNotImported} Jury-ZONK-Markierungen können im aktuellen Jury-Schema nicht gespeichert werden und bleiben unberührt.</li>
      </ul>
      <label className="ks-import-confirm">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>Ich habe den Dry-Run geprüft. Nur die als importierbar markierten Wertungen sollen ergänzt werden.</span>
      </label>
      <div className="ks-inline-actions">
        <button className="ks-button primary" type="button" disabled={!confirmed || applying || summary.readyVotes < 1} onClick={() => void applyImport()}>{applying ? 'Import läuft …' : `${summary.readyVotes} Wertungen importieren`}</button>
        <button className="ks-button secondary" type="button" disabled={applying} onClick={() => void loadReport()}>Dry-Run aktualisieren</button>
      </div>
    </section>

    <section className="ks-import-rounds">
      {report.rounds.map((round) => {
        const needsAttention = round.jurors.some((juror) => juror.status === 'blocked' || juror.status === 'conflict') || round.skippedColumns.some((column) => column.rankingCount > 0);
        return <details className="ks-card" key={round.sheet} open={needsAttention}>
          <summary>
            <span><strong>{dateLabel(round.votingDate)}</strong><small>{round.targetRound?.title || 'Keine Datenbankrunde zugeordnet'}</small></span>
            <span className={`ks-status-badge ${statusTone(round.status)}`}>{round.status === 'complete' ? 'Vollständig vorhanden' : round.status === 'ready' ? 'Importierbar' : round.status === 'partial' ? 'Teilweise importierbar' : 'Prüfung nötig'}</span>
          </summary>
          <div className="ks-import-round-body">
            <p className="ks-import-source-note">Excel: {round.sourceSongs} Songs · {round.jurors.length} valide Juryspalten · {round.zonkEntries} nicht importierbare Jury-ZONKs</p>
            <div className="ks-import-jurors">
              {round.jurors.map((juror) => <article key={`${round.sheet}-${juror.displayName}`}>
                <header><div><strong>{juror.displayName}</strong>{juror.sourceName !== juror.displayName && <small>Excel: {juror.sourceName}</small>}</div><span className={`ks-status-badge ${statusTone(juror.status)}`}>{jurorLabels[juror.status]}</span></header>
                <p>{juror.message} · {juror.matchedSongs}/12 Songs</p>
                {juror.matchReviews.length > 0 && <details className="ks-import-review"><summary>{juror.matchReviews.length} Songbezeichnungen kontrollieren</summary><ul>{juror.matchReviews.map((match) => <li key={`${match.sourceSong}-${match.matchedSong}`}><span>{match.sourceSong}</span><b>→</b><span>{match.matchedSong} <small>({match.confidence} %)</small></span></li>)}</ul></details>}
                {juror.missingSongs.length > 0 && <ul className="ks-import-missing">{juror.missingSongs.map((song) => <li key={song.sourceSong}><strong>{song.sourceSong}</strong>{song.suggestions.length > 0 && <small>Mögliche Treffer: {song.suggestions.join(' · ')}</small>}</li>)}</ul>}
              </article>)}
            </div>
            {round.skippedColumns.length > 0 && <div className="ks-import-source-errors"><h3>Nicht importierte Excel-Spalten</h3>{round.skippedColumns.map((column) => <p key={column.sourceName}><strong>{column.sourceName}:</strong> {column.reason}. {column.rankingCount} Einträge, Summe {column.sum}{column.missingPoints.length ? `, fehlend: ${column.missingPoints.join(', ')}` : ''}{column.duplicatePoints.length ? `, doppelt: ${column.duplicatePoints.map((point) => `${point.point} (${point.count}×)`).join(', ')}` : ''}</p>)}</div>}
          </div>
        </details>;
      })}
    </section>
  </>;
}
