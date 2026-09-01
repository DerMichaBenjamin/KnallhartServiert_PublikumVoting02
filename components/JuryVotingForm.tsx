'use client';

import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { combineSongLine, JURY_PLACES_COUNT, type Song } from '@/lib/releaseVotingShared';

type InitialItem = { song_id: string; points: number };

function shuffleSongs(list: Song[]) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildInitialRanking(songs: Song[], items: InitialItem[]) {
  const songById = new Map(songs.map((song) => [song.id, song]));
  const byPoints = new Map(items.map((item) => [Number(item.points), songById.get(item.song_id) || null]));
  return Array.from({ length: JURY_PLACES_COUNT }, (_, index) => byPoints.get(JURY_PLACES_COUNT - index) || null);
}

export default function JuryVotingForm({
  accessToken,
  songs,
  initialItems,
  jurorName,
  canEdit,
}: {
  accessToken: string;
  songs: Song[];
  initialItems: InitialItem[];
  jurorName: string;
  canEdit: boolean;
}) {
  const [query, setQuery] = useState('');
  const [ranking, setRanking] = useState<(Song | null)[]>(() => buildInitialRanking(songs, initialItems));
  const [displaySongs, setDisplaySongs] = useState<Song[]>(songs);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDisplaySongs(shuffleSongs(songs));
  }, [songs]);

  const rankedIds = ranking.filter(Boolean).map((song) => song!.id);
  const firstFree = ranking.findIndex((song) => !song);
  const available = useMemo(
    () => displaySongs.filter((song) => !rankedIds.includes(song.id) && combineSongLine(song).toLowerCase().includes(query.toLowerCase())),
    [displaySongs, rankedIds.join(','), query]
  );

  function add(song: Song) {
    if (!canEdit || firstFree < 0) return;
    setRanking((current) => {
      const next = [...current];
      next[firstFree] = song;
      return next;
    });
  }

  function remove(index: number) {
    if (!canEdit) return;
    setRanking((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
  }

  function move(index: number, delta: number) {
    if (!canEdit) return;
    const target = index + delta;
    if (target < 0 || target >= ranking.length) return;
    setRanking((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSongRowKeyDown(event: KeyboardEvent<HTMLDivElement>, song: Song) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      add(song);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!canEdit) return;
    if (rankedIds.length !== JURY_PLACES_COUNT) {
      setMessage({ type: 'error', text: `Bitte belege alle ${JURY_PLACES_COUNT} Plätze.` });
      return;
    }

    setLoading(true);
    try {
      const payload = ranking.map((song, index) => ({ songId: song!.id, points: JURY_PLACES_COUNT - index }));
      const response = await fetch('/api/jury-voting/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, ranking: payload }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Ungültige Server-Antwort.');
      setMessage({ type: 'success', text: 'Dein Jury-Voting wurde gespeichert. Du kannst es bis zum Ende der Frist jederzeit erneut bearbeiten.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Fehler beim Speichern.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="vote-form" onSubmit={submit}>
      {message && <div className={`notice ${message.type}`}>{message.text}</div>}
      <section className="card jury-intro-card">
        <small>Persönliches Jury-Voting</small>
        <h2>{jurorName}</h2>
        <p>Ordne exakt 12 Songs. Platz 1 erhält 12 Punkte, Platz 12 erhält 1 Punkt.</p>
        {canEdit ? (
          <div className="notice jury-helper-notice">Song per Klick auf den Titel oder auf <b>Wählen</b> in deine Top 12 übernehmen. Danach mit den Pfeilen sortieren. Bereits gespeicherte Wertungen können bis zum Fristende jederzeit wieder geändert und neu gespeichert werden.</div>
        ) : (
          <div className="notice">Dieses Jury-Voting ist aktuell nicht bearbeitbar. Die zuletzt gespeicherte Reihenfolge bleibt aber sichtbar.</div>
        )}
      </section>

      <div className="vote-workspace">
        <section className="card">
          <h2>Songs</h2>
          <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Suche nach Song oder Artist..." disabled={!canEdit} />
          <div className="song-list-scroll">
            {available.map((song) => (
              <div
                className={`song-row jury-song-row ${canEdit ? 'is-clickable' : 'is-disabled'}`}
                key={song.id}
                onClick={() => add(song)}
                onKeyDown={(event) => handleSongRowKeyDown(event, song)}
                role={canEdit ? 'button' : undefined}
                tabIndex={canEdit ? 0 : -1}
              >
                <div className="jury-song-text">{combineSongLine(song)}</div>
                <button type="button" className="song-action-btn" onClick={(event) => { event.stopPropagation(); add(song); }} disabled={!canEdit}>Wählen</button>
              </div>
            ))}
          </div>
          <small>{available.length} Songs verfügbar</small>
        </section>

        <section className="card">
          <h2>Deine Top 12 <span>{rankedIds.length}/{JURY_PLACES_COUNT}</span></h2>
          <div className="rank-list-scroll">
            {ranking.map((song, index) => (
              <div className="rank-row jury-rank-row" key={index}>
                <b>{index + 1}</b>
                {song ? <span>{combineSongLine(song)} <small>· {JURY_PLACES_COUNT - index} P.</small></span> : <em>Noch kein Song gewählt</em>}
                <div>
                  {song && canEdit && (
                    <>
                      <button type="button" onClick={() => move(index, -1)}>↑</button>
                      <button type="button" onClick={() => move(index, 1)}>↓</button>
                      <button type="button" onClick={() => remove(index)}>×</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {canEdit ? (
        <button className="submit" disabled={loading || rankedIds.length !== JURY_PLACES_COUNT}>
          {loading ? 'Speichert…' : initialItems.length ? 'Jury-Voting aktualisieren' : 'Jury-Voting speichern'}
        </button>
      ) : (
        <div className="notice">Das Voting ist geschlossen. Deine zuletzt gespeicherte Rangliste bleibt oben sichtbar.</div>
      )}
    </form>
  );
}
