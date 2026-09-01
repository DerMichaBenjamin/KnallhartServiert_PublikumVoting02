'use client';

import { useMemo, useState } from 'react';
import type { LeaderboardRow, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { combineSongLine, JURY_PLACES_COUNT } from '@/lib/releaseVotingShared';

type Props = {
  songs: Song[];
  publicLeaderboard: LeaderboardRow[];
  publicVerifiedVotes: number;
  juryData: AdminJuryRoundData;
};

type MatrixRow = {
  song: Song;
  juryPoints: Record<string, number>;
  audiencePoints: number;
  total: number;
  overallRank: number | null;
};

type FocusRow = {
  song: Song;
  points: number;
  rank: number;
};

function compareSongs(a: Song, b: Song) {
  return a.title.localeCompare(b.title, 'de', { sensitivity: 'base' })
    || a.artist.localeCompare(b.artist, 'de', { sensitivity: 'base' });
}

function assignCompetitionRanks(rows: Omit<MatrixRow, 'overallRank'>[], hasVotes: boolean): MatrixRow[] {
  let previousTotal: number | null = null;
  let previousRank = 0;

  return rows.map((row, index) => {
    if (!hasVotes) return { ...row, overallRank: null };

    const rank = previousTotal === row.total ? previousRank : index + 1;
    previousTotal = row.total;
    previousRank = rank;
    return { ...row, overallRank: rank };
  });
}

export default function JuryResultsMatrix({ songs, publicLeaderboard, publicVerifiedVotes, juryData }: Props) {
  const [activeView, setActiveView] = useState('overall');

  const activeJurors = useMemo(() => juryData.jurors.filter((juror) => juror.is_active), [juryData.jurors]);
  const submittedJurors = useMemo(() => activeJurors.filter((juror) => Boolean(juror.submitted_at)), [activeJurors]);

  const audiencePoints = useMemo(() => {
    const map = new Map<string, number>();
    if (publicVerifiedVotes <= 0) return map;

    const sorted = [...publicLeaderboard].sort((a, b) =>
      b.total - a.total
      || compareSongs(a.song, b.song)
    );

    sorted.slice(0, JURY_PLACES_COUNT).forEach((row, index) => {
      map.set(row.song.id, JURY_PLACES_COUNT - index);
    });

    return map;
  }, [publicLeaderboard, publicVerifiedVotes]);

  const juryPointsByJuror = useMemo(() => {
    const outer = new Map<string, Map<string, number>>();

    for (const juror of activeJurors) {
      const points = new Map<string, number>();
      if (juror.submitted_at) {
        for (const item of juror.items) {
          const value = Number(item.points);
          if (Number.isFinite(value) && value >= 1 && value <= JURY_PLACES_COUNT) {
            points.set(item.song_id, value);
          }
        }
      }
      outer.set(juror.id, points);
    }

    return outer;
  }, [activeJurors]);

  const overallRows = useMemo(() => {
    const rows: Omit<MatrixRow, 'overallRank'>[] = songs.map((song) => {
      const juryPoints: Record<string, number> = {};
      let total = audiencePoints.get(song.id) || 0;

      for (const juror of activeJurors) {
        const points = juryPointsByJuror.get(juror.id)?.get(song.id) || 0;
        juryPoints[juror.id] = points;
        total += points;
      }

      return {
        song,
        juryPoints,
        audiencePoints: audiencePoints.get(song.id) || 0,
        total,
      };
    });

    rows.sort((a, b) => b.total - a.total || compareSongs(a.song, b.song));
    const hasVotes = audiencePoints.size > 0 || submittedJurors.length > 0;
    return assignCompetitionRanks(rows, hasVotes);
  }, [songs, audiencePoints, activeJurors, juryPointsByJuror, submittedJurors.length]);

  const matrixRows = useMemo(() => {
    const rows = [...overallRows];
    if (activeView === 'overall') return rows;

    if (activeView === 'audience') {
      return rows.sort((a, b) =>
        b.audiencePoints - a.audiencePoints
        || compareSongs(a.song, b.song)
      );
    }

    return rows.sort((a, b) =>
      (b.juryPoints[activeView] || 0) - (a.juryPoints[activeView] || 0)
      || compareSongs(a.song, b.song)
    );
  }, [overallRows, activeView]);

  const focusRows = useMemo<FocusRow[]>(() => {
    if (activeView === 'overall') return [];

    const points = activeView === 'audience'
      ? audiencePoints
      : juryPointsByJuror.get(activeView) || new Map<string, number>();

    return songs
      .map((song) => ({ song, points: points.get(song.id) || 0 }))
      .filter((row) => row.points > 0)
      .sort((a, b) => b.points - a.points || compareSongs(a.song, b.song))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }, [activeView, audiencePoints, juryPointsByJuror, songs]);

  const activeJuror = activeJurors.find((juror) => juror.id === activeView) || null;
  const activeLabel = activeView === 'overall' ? 'Gesamtwertung' : activeView === 'audience' ? 'Publikum' : activeJuror?.display_name || 'Juror';
  const activeHasVote = activeView === 'overall'
    || (activeView === 'audience' ? publicVerifiedVotes > 0 : Boolean(activeJuror?.submitted_at));

  const countedSources = submittedJurors.length + (publicVerifiedVotes > 0 ? 1 : 0);

  return (
    <section className="admin-card jury-results-card">
      <div className="jury-results-heading">
        <div>
          <h2>Gesamtwertung Jury + Publikum</h2>
          <p className="admin-help-text">
            Das Publikum zählt als genau ein Juror: Die Publikums-Top-12 erhält 12 bis 1 Punkt. Bei Gleichstand im Publikum entscheidet für diese Reihenfolge alphabetisch zuerst der Songtitel, dann der Künstler. In der Gesamtwertung erhalten Songs mit identischer Gesamtpunktzahl denselben Platz.
          </p>
        </div>
        <div className="jury-results-stats">
          <span className="status-badge">Juroren {submittedJurors.length}/{activeJurors.length}</span>
          <span className="status-badge">Publikum {publicVerifiedVotes} bestätigt</span>
          <span className="status-badge">Gewertet: {countedSources} Stimmen</span>
        </div>
      </div>

      <div className="jury-view-tabs" role="tablist" aria-label="Auswertung sortieren">
        <button type="button" className={activeView === 'overall' ? 'active' : ''} onClick={() => setActiveView('overall')}>Gesamt</button>
        <button type="button" className={activeView === 'audience' ? 'active' : ''} onClick={() => setActiveView('audience')}>Publikum</button>
        {activeJurors.map((juror) => (
          <button
            type="button"
            key={juror.id}
            className={activeView === juror.id ? 'active' : ''}
            onClick={() => setActiveView(juror.id)}
          >
            {juror.display_name}{juror.submitted_at ? '' : ' · offen'}
          </button>
        ))}
      </div>

      {activeView !== 'overall' && (
        <div className="jury-focus-panel">
          <h3>Rangliste: {activeLabel}</h3>
          {activeHasVote && focusRows.length ? (
            <div className="admin-table-wrap compact">
              <table className="jury-focus-table">
                <thead><tr><th>Rang</th><th>Song</th><th>Punkte</th></tr></thead>
                <tbody>
                  {focusRows.map((row) => (
                    <tr key={row.song.id}>
                      <td><b>{row.rank}</b></td>
                      <td>{combineSongLine(row.song)}</td>
                      <td><b>{row.points}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="notice">Für {activeLabel} liegt noch keine abgeschlossene Wertung vor.</div>
          )}
        </div>
      )}

      <div className="jury-matrix-title-row">
        <h3>Matrix</h3>
        <span>Sortiert nach: <b>{activeLabel}</b></span>
      </div>

      <div className="admin-table-wrap jury-matrix-wrap">
        <table className="jury-matrix-table">
          <thead>
            <tr>
              <th>Ges.-Rang</th>
              <th>Song</th>
              {activeJurors.map((juror) => (
                <th key={juror.id} className={activeView === juror.id ? 'active-column' : ''}>
                  <button type="button" onClick={() => setActiveView(juror.id)}>{juror.display_name}</button>
                </th>
              ))}
              <th className={activeView === 'audience' ? 'active-column' : ''}>
                <button type="button" onClick={() => setActiveView('audience')}>Publikum</button>
              </th>
              <th className={activeView === 'overall' ? 'active-column' : ''}>
                <button type="button" onClick={() => setActiveView('overall')}>Gesamt</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {matrixRows.map((row) => (
              <tr key={row.song.id}>
                <td><b>{row.overallRank ?? '—'}</b></td>
                <td className="jury-song-cell">{combineSongLine(row.song)}</td>
                {activeJurors.map((juror) => {
                  const points = row.juryPoints[juror.id] || 0;
                  return (
                    <td key={juror.id} className={activeView === juror.id ? 'active-column' : ''}>
                      {juror.submitted_at ? (points || '—') : <span className="jury-open-cell">offen</span>}
                    </td>
                  );
                })}
                <td className={activeView === 'audience' ? 'active-column' : ''}>{publicVerifiedVotes > 0 ? (row.audiencePoints || '—') : '—'}</td>
                <td className={`jury-total-cell ${activeView === 'overall' ? 'active-column' : ''}`}><b>{countedSources ? row.total : '—'}</b></td>
              </tr>
            ))}
            {!matrixRows.length && <tr><td colSpan={activeJurors.length + 4}>Keine Songs in dieser Runde vorhanden.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="admin-help-text jury-results-footnote">
        Nur abgegebene Jury-Wertungen werden addiert. Nicht platzierte Songs erhalten von der jeweiligen Stimme 0 Punkte. Die Publikumswertung wird erst berücksichtigt, sobald mindestens eine bestätigte Publikumsstimme vorliegt.
      </p>
    </section>
  );
}
