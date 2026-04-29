'use client';

import { useEffect, useMemo, useState } from 'react';
import { combineSongLine } from '@/lib/releaseVoting';

type PublicVotingFormProps = {
  roundId: string;
  roundTitle: string;
  placesCount: number;
  songs: string[];
};

type MessageState = { type: 'success' | 'error'; text: string } | null;

type DragPayload =
  | { kind: 'song'; song: string }
  | { kind: 'slot'; song: string; index: number };

export default function PublicVotingForm({
  roundId,
  placesCount,
  songs,
}: PublicVotingFormProps) {
  const [jurorName, setJurorName] = useState('');
  const [jurorEmail, setJurorEmail] = useState('');
  const [jurorInstagram, setJurorInstagram] = useState('');
  const [query, setQuery] = useState('');
  const [ranking, setRanking] = useState<(string | null)[]>(
    () => Array.from({ length: placesCount }, () => null)
  );
  const [zonkSong, setZonkSong] = useState('');
  const [message, setMessage] = useState<MessageState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTouchMode, setIsTouchMode] = useState(false);

  useEffect(() => {
    const updateMode = () => {
      const touchCapable =
        typeof window !== 'undefined' &&
        ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches);
      setIsTouchMode(Boolean(touchCapable));
    };

    updateMode();
    window.addEventListener('resize', updateMode);
    return () => window.removeEventListener('resize', updateMode);
  }, []);

  const pointValues = useMemo(
    () => Array.from({ length: placesCount }, (_, index) => placesCount - index),
    [placesCount]
  );

  const rankedSongs = useMemo(() => ranking.filter(Boolean) as string[], [ranking]);
  const firstFreeIndex = useMemo(() => ranking.findIndex((entry) => !entry), [ranking]);

  const availableSongs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return songs.filter((song) => {
      if (rankedSongs.includes(song)) return false;
      if (!normalizedQuery) return true;
      return song.toLowerCase().includes(normalizedQuery);
    });
  }, [songs, rankedSongs, query]);

  const filledSlots = rankedSongs.length;
  const isComplete = filledSlots === placesCount;

  function setSongAtIndex(song: string, targetIndex: number) {
    setRanking((prev) => {
      const next = [...prev];
      const sourceIndex = next.findIndex((entry) => entry === song);
      const targetSong = next[targetIndex];

      if (sourceIndex === targetIndex) return next;

      if (sourceIndex >= 0) {
        next[sourceIndex] = targetSong ?? null;
        next[targetIndex] = song;
        return next;
      }

      next[targetIndex] = song;
      return next;
    });
  }

  function addSongToNextFree(song: string) {
    if (firstFreeIndex < 0) return;
    setSongAtIndex(song, firstFreeIndex);
  }

  function removeFromSlot(index: number) {
    setRanking((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  }

  function moveSlot(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= ranking.length) return;

    setRanking((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  }

  function serializePayload(payload: DragPayload) {
    return JSON.stringify(payload);
  }

  function parsePayload(raw: string): DragPayload | null {
    try {
      const parsed = JSON.parse(raw) as DragPayload;
      if (parsed.kind === 'song' && typeof parsed.song === 'string') return parsed;
      if (parsed.kind === 'slot' && typeof parsed.song === 'string' && typeof parsed.index === 'number') return parsed;
      return null;
    } catch {
      return null;
    }
  }

  function onDropOnSlot(event: React.DragEvent<HTMLDivElement>, targetIndex: number) {
    if (isTouchMode) return;
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
    const payload = parsePayload(raw);
    if (!payload) return;
    setSongAtIndex(payload.song, targetIndex);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const rankingPayload = ranking
      .map((song, index) => (song ? { song, points: pointValues[index] } : null))
      .filter(Boolean) as { song: string; points: number }[];

    if (rankingPayload.length !== placesCount) {
      setMessage({ type: 'error', text: `Bitte belege alle ${placesCount} Plätze.` });
      return;
    }

    const uniqueSongs = new Set(rankingPayload.map((entry) => entry.song));
    if (uniqueSongs.size !== rankingPayload.length) {
      setMessage({ type: 'error', text: 'Jeder Song darf nur einmal im Ranking vorkommen.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/release-voting/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId,
          jurorName,
          jurorEmail,
          jurorInstagram,
          ranking: rankingPayload,
          zonkSong: zonkSong || null,
        }),
      });

      const result = await response.json().catch(() => ({ ok: false, error: 'Ungültige Server-Antwort.' }));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Abstimmung konnte nicht gespeichert werden.');

      setMessage({
        type: 'success',
        text: 'Fast geschafft: Bitte bestätige dein Voting über den Link in deiner E-Mail. Die Mail kann einige Minuten dauern. Bitte auch den Spam-Ordner prüfen.',
      });
      setJurorName('');
      setJurorEmail('');
      setJurorInstagram('');
      setQuery('');
      setZonkSong('');
      setRanking(Array.from({ length: placesCount }, () => null));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Abstimmung konnte nicht gespeichert werden.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const instructionText = isTouchMode
    ? 'Song antippen oder + drücken. Mit ↑ / ↓ sortierst du deine Top 12.'
    : 'Song anklicken, + drücken oder per Drag & Drop in deine Top 12 ziehen.';

  return (
    <form className={`public-voting-form ${isTouchMode ? 'touch-mode' : 'desktop-mode'}`} onSubmit={onSubmit}>
      {message && <div className={message.type === 'success' ? 'notice success' : 'notice error'}>{message.text}</div>}

      <section className="table-card contact-card">
        <div className="field">
          <label htmlFor="jurorName">Dein Name</label>
          <input id="jurorName" value={jurorName} onChange={(event) => setJurorName(event.target.value)} placeholder="Max Mustermann" required />
        </div>
        <div className="field">
          <label htmlFor="jurorEmail">Deine E-Mail</label>
          <input id="jurorEmail" type="email" value={jurorEmail} onChange={(event) => setJurorEmail(event.target.value)} placeholder="max@beispiel.de" required />
        </div>
        <div className="field">
          <label htmlFor="jurorInstagram">Instagram optional</label>
          <input id="jurorInstagram" value={jurorInstagram} onChange={(event) => setJurorInstagram(event.target.value)} placeholder="@mein_urlaubsmoment" />
        </div>
      </section>

      <section className="vote-workspace">
        <article className="table-card song-picker-card">
          <div className="section-head compact-gap">
            <div>
              <h2 className="section-title compact-title">Songs</h2>
              <p className="section-subtitle">{instructionText}</p>
            </div>
            <span className="progress-pill neutral">{availableSongs.length}</span>
          </div>

          <div className="field compact-search-field">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Song oder Interpret suchen ..." />
          </div>

          <div className="song-list-scroll">
            <div className="available-list compact-available-list">
              {availableSongs.map((song) => (
                <div
                  key={song}
                  className="available-card compact-available-card improved-available-card"
                  draggable={!isTouchMode}
                  onDragStart={(event) => {
                    if (isTouchMode) return;
                    event.dataTransfer.setData('application/json', serializePayload({ kind: 'song', song }));
                  }}
                >
                  <button type="button" className="available-card-main available-card-main-clickable" onClick={() => addSongToNextFree(song)} disabled={firstFreeIndex < 0}>
                    <span className="song-line">{combineSongLine(song)}</span>
                  </button>
                  <button type="button" className="button secondary small compact-add-button" onClick={() => addSongToNextFree(song)} disabled={firstFreeIndex < 0}>+</button>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="table-card ranking-card">
          <div className="section-head compact-gap">
            <div>
              <h2 className="section-title compact-title">Deine Top 12</h2>
              <p className="section-subtitle">Oben gibt es die meisten Punkte.</p>
            </div>
            <span className="progress-pill">{filledSlots}/{placesCount}</span>
          </div>

          <div className="rank-list-scroll">
            <div className="rank-slots compact-rank-slots improved-rank-slots">
              {pointValues.map((points, index) => {
                const song = ranking[index];
                return (
                  <div
                    key={points}
                    className={`rank-slot compact-rank-slot improved-rank-slot${song ? ' filled' : ''}`}
                    onDragOver={(event) => {
                      if (isTouchMode) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => onDropOnSlot(event, index)}
                  >
                    <div className="rank-slot-topline">
                      <span className="rank-slot-points">{points}</span>
                      <span className="rank-slot-position">#{index + 1}</span>
                    </div>

                    {!song && <div className="rank-slot-empty">Noch kein Song gewählt</div>}

                    {song && (
                      <div
                        draggable={!isTouchMode}
                        onDragStart={(event) => {
                          if (isTouchMode) return;
                          event.dataTransfer.setData('application/json', serializePayload({ kind: 'slot', song, index }));
                        }}
                        className="rank-slot-song compact-rank-song"
                      >
                        <div className="song-line">{combineSongLine(song)}</div>
                        <div className="slot-actions">
                          <button type="button" className="button ghost tiny" onClick={() => moveSlot(index, -1)} disabled={index === 0}>↑</button>
                          <button type="button" className="button ghost tiny" onClick={() => moveSlot(index, 1)} disabled={index === ranking.length - 1}>↓</button>
                          <button type="button" className="button ghost tiny" onClick={() => removeFromSlot(index)}>×</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      </section>

      <section className="table-card zonk-card">
        <div>
          <h2 className="section-title compact-title">Z-O-N-K – Song der Woche optional</h2>
          <p className="section-subtitle">Der schlechteste Song der Woche. Diese Auswahl zählt getrennt von deiner Top 12.</p>
        </div>
        <select value={zonkSong} onChange={(event) => setZonkSong(event.target.value)}>
          <option value="">Keinen Z-O-N-K auswählen</option>
          {songs.map((song) => (
            <option key={song} value={song}>{combineSongLine(song)}</option>
          ))}
        </select>
      </section>

      <div className={`submit-bar${isComplete ? ' visible' : ''}`}>
        <div className="submit-bar-copy">{isComplete ? 'Alle 12 Plätze sind belegt.' : `Noch ${placesCount - filledSlots} Platz/Plätze offen.`}</div>
        <button className="button primary submit-bar-button" type="submit" disabled={isSubmitting || !isComplete}>
          {isSubmitting ? 'Speichert…' : 'Stimme per E-Mail bestätigen & absenden'}
        </button>
      </div>
    </form>
  );
}
