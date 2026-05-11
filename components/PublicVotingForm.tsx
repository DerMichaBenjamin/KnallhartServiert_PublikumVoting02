'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Song, combineSongLine } from '@/lib/releaseVoting';

type Message = {
  type: 'success' | 'error';
  text: string;
};

type PublicVotingFormProps = {
  roundId: string;
  roundTitle: string;
  placesCount: number;
  songs: Song[];
};

function shuffleSongs(list: Song[]): Song[] {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

export default function PublicVotingForm({
  roundId,
  roundTitle,
  placesCount,
  songs,
}: PublicVotingFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [insta, setInsta] = useState('');
  const [query, setQuery] = useState('');
  const [ranking, setRanking] = useState<(Song | null)[]>(
    Array.from({ length: placesCount }, () => null)
  );
  const [zonk, setZonk] = useState('');
  const [msg, setMsg] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [displaySongs, setDisplaySongs] = useState<Song[]>([]);

  useEffect(() => {
    setDisplaySongs(shuffleSongs(songs));
    setRanking(Array.from({ length: placesCount }, () => null));
    setZonk('');
    setQuery('');
    setMsg(null);
  }, [roundId, placesCount, songs]);

  const rankedSongs = ranking.filter((song): song is Song => Boolean(song));
  const rankedIds = rankedSongs.map((song) => song.id);
  const firstFree = ranking.findIndex((song) => !song);

  const available = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    return displaySongs.filter((song) => {
      const isAlreadyRanked = rankedIds.includes(song.id);
      const matchesQuery = combineSongLine(song).toLowerCase().includes(lowerQuery);

      return !isAlreadyRanked && matchesQuery;
    });
  }, [displaySongs, rankedIds, query]);

  function add(song: Song) {
    if (firstFree < 0) return;

    setRanking((current) => {
      const next = [...current];
      next[firstFree] = song;
      return next;
    });
  }

  function remove(index: number) {
    setRanking((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
  }

  function move(index: number, direction: number) {
    const target = index + direction;

    if (target < 0 || target >= ranking.length) return;

    setRanking((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMsg(null);

    const selectedSongs = ranking.filter((song): song is Song => Boolean(song));

    if (selectedSongs.length !== placesCount) {
      setMsg({
        type: 'error',
        text: `Bitte belege alle ${placesCount} Plätze.`,
      });
      return;
    }

    setLoading(true);

    try {
      const payload = ranking.map((song, index) => ({
        songId: song!.id,
        points: placesCount - index,
      }));

      const response = await fetch('/api/release-voting/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roundId,
          jurorName: name,
          jurorEmail: email,
          jurorInstagram: insta,
          ranking: payload,
          zonkSongId: zonk || null,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Ungültige Server-Antwort.');
      }

      setMsg({
        type: 'success',
        text:
          'Fast geschafft: Bitte bestätige dein Voting über den Link in deiner E-Mail. ' +
          'Die Mail kann einige Minuten dauern. Prüfe bitte auch den Spam-Ordner.',
      });

      setRanking(Array.from({ length: placesCount }, () => null));
      setName('');
      setEmail('');
      setInsta('');
      setZonk('');
    } catch (error) {
      setMsg({
        type: 'error',
        text: error instanceof Error ? error.message : 'Fehler beim Absenden.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="vote-form">
      {msg && <div className={`notice ${msg.type}`}>{msg.text}</div>}

      <div className="input-grid">
        <label>
          Name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Dein Name"
          />
        </label>

        <label>
          E-Mail
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="für Bestätigung"
          />
        </label>

        <label>
          Instagram
          <input
            value={insta}
            onChange={(event) => setInsta(event.target.value)}
            placeholder="optional"
          />
        </label>
      </div>

      <div className="vote-workspace">
        <section className="card">
          <h2>Songs</h2>

          <input
            className="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Suche nach Song oder Artist..."
          />

          <div className="song-list-scroll">
            {available.map((song) => (
              <div className="song-row" key={song.id}>
                <button type="button" onClick={() => add(song)}>
                  {combineSongLine(song)}
                </button>

                <button type="button" className="plus" onClick={() => add(song)}>
                  +
                </button>
              </div>
            ))}
          </div>

          <small>{available.length} Songs verfügbar</small>
        </section>

        <section className="card">
          <h2>
            Deine Top 12 <span>{rankedIds.length}/{placesCount}</span>
          </h2>

          <div className="rank-list-scroll">
            {ranking.map((song, index) => (
              <div className="rank-row" key={index}>
                <b>{index + 1}</b>

                {song ? (
                  <span>{combineSongLine(song)}</span>
                ) : (
                  <em>Noch kein Song gewählt</em>
                )}

                <div>
                  {song && (
                    <>
                      <button type="button" onClick={() => move(index, -1)}>
                        ↑
                      </button>
                      <button type="button" onClick={() => move(index, 1)}>
                        ↓
                      </button>
                      <button type="button" onClick={() => remove(index)}>
                        ×
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card zonk">
        <h3>
          ZONK – Song der Woche <small>(optional)</small>
        </h3>

        <p>Wähle hier den schlechtesten Song der Woche.</p>

        <select value={zonk} onChange={(event) => setZonk(event.target.value)}>
          <option value="">Keinen ZONK wählen</option>

          {displaySongs.map((song) => (
            <option key={song.id} value={song.id}>
              {combineSongLine(song)}
            </option>
          ))}
        </select>
      </section>

      <button
        className="submit"
        disabled={loading || rankedIds.length !== placesCount}
      >
        {loading ? 'Sendet…' : 'Stimme per E-Mail bestätigen & absenden'}
      </button>
    </form>
  );
}
