'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import type { ImprintSettings, LeaderboardRow, RoundRow, VoteRow, ZonkRow } from '@/lib/releaseVoting';
import {
  createPublicRoundPath,
  createRoundDatePreset,
  formatDateTime,
  normalizeSlug,
  splitSong,
  statusLabel,
  toDatetimeLocalValue,
} from '@/lib/releaseVoting';
import type { SupabaseConfigState } from '@/lib/supabaseAdmin';

type AdminDashboardProps = {
  configState: SupabaseConfigState;
  rounds: RoundRow[];
  currentRound: RoundRow | null;
  currentVotes: VoteRow[];
  voteStats: { submitted: number; verified: number; pending: number };
  leaderboard: LeaderboardRow[];
  zonkLeaderboard: ZonkRow[];
  imprintSettings: ImprintSettings;
  loadError: string | null;
};

type MessageState = { type: 'success' | 'error'; text: string } | null;

const DEFAULT_PLAYLIST = '5F2g4rTr0KpYgy9YGiE4aI';

function createInitialFormState() {
  const now = new Date();
  const preset = createRoundDatePreset(now);
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    title: preset.title,
    slug: preset.slug,
    description: 'Bewerte die stärksten neuen Releases der Woche.',
    status: 'live',
    start_at: toDatetimeLocalValue(now),
    end_at: toDatetimeLocalValue(end),
    places_count: '12',
    spotify_playlist_id: DEFAULT_PLAYLIST,
    songlist: '',
  };
}

export default function AdminDashboard({
  configState,
  rounds,
  currentRound,
  currentVotes,
  voteStats,
  leaderboard,
  zonkLeaderboard,
  imprintSettings,
  loadError,
}: AdminDashboardProps) {
  const router = useRouter();
  const [message, setMessage] = useState<MessageState>(null);
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState(createInitialFormState);
  const [slugTouched, setSlugTouched] = useState(false);
  const [addSongsByRound, setAddSongsByRound] = useState<Record<string, string>>({});
  const [playlistByRound, setPlaylistByRound] = useState<Record<string, string>>({});
  const [imprintContent, setImprintContent] = useState(imprintSettings.content);
  const recentVotes = useMemo(() => currentVotes.slice(0, 10), [currentVotes]);

  async function sendJson(url: string, payload: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({ ok: false, error: 'Ungültige Server-Antwort.' }));
    if (!response.ok || !result.ok) throw new Error(result.error || 'Aktion fehlgeschlagen.');
    return result;
  }

  function refreshWithMessage(nextMessage: MessageState) {
    setMessage(nextMessage);
    startTransition(() => router.refresh());
  }

  async function onCreateRound(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const result = await sendJson('/api/admin/create-round', {
        ...formState,
        places_count: Number(formState.places_count),
      });

      setFormState(createInitialFormState());
      setSlugTouched(false);
      refreshWithMessage({ type: 'success', text: `Umfrage wurde angelegt: ${result.round?.title ?? 'Neue Runde'}` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Umfrage konnte nicht angelegt werden.' });
    }
  }

  async function onSetCurrent(roundId: string) {
    setMessage(null);
    try {
      const result = await sendJson('/api/admin/set-current', { roundId });
      refreshWithMessage({ type: 'success', text: `Aktive Umfrage gesetzt: ${result.round?.title ?? 'Runde aktiviert'}` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Aktivieren fehlgeschlagen.' });
    }
  }

  async function onEndRound(roundId: string) {
    setMessage(null);
    try {
      const result = await sendJson('/api/admin/end-round', { roundId });
      refreshWithMessage({ type: 'success', text: `Umfrage beendet: ${result.round?.title ?? 'Runde beendet'}` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Beenden fehlgeschlagen.' });
    }
  }

  async function onUpdateRound(round: RoundRow) {
    setMessage(null);
    const addSongs = addSongsByRound[round.id] ?? '';
    const spotifyValue = playlistByRound[round.id] ?? round.spotify_playlist_id ?? '';

    try {
      const result = await sendJson('/api/admin/update-round', {
        roundId: round.id,
        addSongs,
        spotify_playlist_id: spotifyValue,
      });
      setAddSongsByRound((prev) => ({ ...prev, [round.id]: '' }));
      refreshWithMessage({ type: 'success', text: `Umfrage aktualisiert: ${result.round?.title ?? round.title}` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Aktualisieren fehlgeschlagen.' });
    }
  }

  async function onUpdateImprint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      await sendJson('/api/admin/update-imprint', { content: imprintContent });
      refreshWithMessage({ type: 'success', text: 'Impressum wurde aktualisiert.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Impressum konnte nicht gespeichert werden.' });
    }
  }

  async function onLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <main className="dashboard-shell">
      <header className="hero-card dashboard-hero">
        <div className="hero-main">
          <BrandLogo />
          <div className="pill">Interner Verwaltungsbereich</div>
          <h1 className="hero-title">Release Voting verwalten</h1>
          <p className="hero-copy">Umfragen anlegen, Spotify-Playlist setzen, Songs nachtragen und Z-O-N-K separat auswerten.</p>
        </div>

        <div className="hero-actions">
          <div className="hero-stat-card">
            <div className="small-text">Aktive Umfrage</div>
            <div className="hero-stat-value">{currentRound?.title ?? 'Keine'}</div>
          </div>
          <button type="button" className="button ghost" onClick={onLogout}>Ausloggen</button>
        </div>
      </header>

      {!configState.ok && <div className="notice error">{configState.message}</div>}
      {loadError && <div className="notice error">Fehler beim Laden: {loadError}</div>}
      {message && <div className={message.type === 'success' ? 'notice success' : 'notice error'}>{message.text}</div>}

      <section className="stats-grid stats-grid-5">
        <article className="info-card"><div className="stat-label">Aktuelle Runde</div><div className="stat-value">{currentRound?.title || '—'}</div><div className="stat-sub">{currentRound ? statusLabel(currentRound.status) : 'Keine Runde live gesetzt'}</div></article>
        <article className="info-card"><div className="stat-label">Angelegte Umfragen</div><div className="stat-value">{rounds.length}</div><div className="stat-sub">inklusive Entwürfe und beendete Runden</div></article>
        <article className="info-card"><div className="stat-label">Abgegeben</div><div className="stat-value">{voteStats.submitted}</div><div className="stat-sub">alle abgeschickten Stimmen</div></article>
        <article className="info-card"><div className="stat-label">Bestätigt</div><div className="stat-value">{voteStats.verified}</div><div className="stat-sub">zählen in der Wertung</div></article>
        <article className="info-card"><div className="stat-label">Unbestätigt</div><div className="stat-value">{voteStats.pending}</div><div className="stat-sub">warten auf E-Mail-Klick</div></article>
      </section>

      <section className="two-col admin-columns">
        <article className="table-card elevated-card">
          <div className="section-head"><div><h2 className="section-title">Neue Umfrage anlegen</h2><p className="section-subtitle">Spotify-Playlist, Zeitraum, Songs und Slug festlegen.</p></div></div>
          <form className="form-stack" onSubmit={onCreateRound}>
            <div className="field"><label htmlFor="title">Titel</label><input id="title" value={formState.title} onChange={(event) => { const title = event.target.value; setFormState((prev) => ({ ...prev, title, slug: slugTouched ? prev.slug : normalizeSlug(title) })); }} required /></div>
            <div className="grid-2">
              <div className="field"><label htmlFor="slug">Slug / URL-Kürzel</label><input id="slug" value={formState.slug} onChange={(event) => { setSlugTouched(true); setFormState((prev) => ({ ...prev, slug: event.target.value })); }} required /></div>
              <div className="field"><label htmlFor="places">Platzanzahl</label><input id="places" type="number" min={1} max={50} value={formState.places_count} onChange={(event) => setFormState((prev) => ({ ...prev, places_count: event.target.value }))} required /></div>
            </div>
            <div className="field"><label htmlFor="spotify">Spotify-Playlist-ID oder Playlist-Link</label><input id="spotify" value={formState.spotify_playlist_id} onChange={(event) => setFormState((prev) => ({ ...prev, spotify_playlist_id: event.target.value }))} placeholder="5F2g4rTr0KpYgy9YGiE4aI" /></div>
            <div className="field"><label htmlFor="description">Beschreibung</label><input id="description" value={formState.description} onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))} /></div>
            <div className="grid-3">
              <div className="field"><label htmlFor="status">Status</label><select id="status" value={formState.status} onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value }))}><option value="live">Live</option><option value="draft">Entwurf</option><option value="ended">Beendet</option></select></div>
              <div className="field"><label htmlFor="startAt">Start</label><input id="startAt" type="datetime-local" value={formState.start_at} onChange={(event) => setFormState((prev) => ({ ...prev, start_at: event.target.value }))} required /></div>
              <div className="field"><label htmlFor="endAt">Ende</label><input id="endAt" type="datetime-local" value={formState.end_at} onChange={(event) => setFormState((prev) => ({ ...prev, end_at: event.target.value }))} required /></div>
            </div>
            <div className="field"><label htmlFor="songlist">Songliste</label><textarea id="songlist" value={formState.songlist} onChange={(event) => setFormState((prev) => ({ ...prev, songlist: event.target.value }))} placeholder={'Songtitel – Interpret\nSongtitel – Interpret'} required /></div>
            <button className="button primary full" type="submit" disabled={isPending || !configState.ok}>{isPending ? 'Speichert...' : 'Umfrage anlegen'}</button>
          </form>
        </article>

        <article className="table-card elevated-card">
          <h2 className="section-title">Impressum</h2>
          <p className="section-subtitle">Der Link erscheint klein im Frontend. Den Inhalt kannst du hier bearbeiten.</p>
          <form className="form-stack" onSubmit={onUpdateImprint}>
            <div className="field">
              <label htmlFor="imprintContent">Impressum-Text</label>
              <textarea
                id="imprintContent"
                className="imprint-editor"
                value={imprintContent}
                onChange={(event) => setImprintContent(event.target.value)}
                placeholder={"Impressum\n\nAngaben gemäß § 5 TMG..."}
              />
            </div>
            <button className="button secondary full" type="submit" disabled={isPending || !configState.ok}>
              Impressum speichern
            </button>
          </form>
          <div className="notice warn" style={{ marginTop: 14 }}>
            Bitte die Angaben rechtlich prüfen. Ich kann dir die technische Editierbarkeit bauen, aber kein rechtsverbindliches Impressum garantieren.
          </div>
        </article>
      </section>

      <section className="table-card elevated-card">
        <div className="section-head"><div><h2 className="section-title">Alle Umfragen</h2><p className="section-subtitle">Mit Direktlink, Spotify-ID und schnellen Aktionen pro Runde.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>Titel</th><th>Status</th><th>Zeitraum</th><th>Spotify / Songs ergänzen</th><th>Link</th><th>Aktionen</th></tr></thead><tbody>
          {rounds.length === 0 && <tr><td colSpan={6}><div className="empty-state">Noch keine Umfragen vorhanden.</div></td></tr>}
          {rounds.map((round) => {
            const publicPath = createPublicRoundPath(round.slug);
            return (
              <tr key={round.id}>
                <td><div style={{ fontWeight: 700 }}>{round.title}</div><div className="mono">{round.slug}</div><div className="small-text">{round.songs_json?.length ?? 0} Songs</div></td>
                <td><span className={`status-chip ${round.status}`}>{statusLabel(round.status)}</span>{round.is_current && <div className="small-text" style={{ marginTop: 8 }}>aktuelle Runde</div>}</td>
                <td><div>{formatDateTime(round.start_at)}</div><div className="small-text">bis {formatDateTime(round.end_at)}</div></td>
                <td>
                  <div className="admin-inline-editor">
                    <input value={playlistByRound[round.id] ?? round.spotify_playlist_id ?? ''} onChange={(event) => setPlaylistByRound((prev) => ({ ...prev, [round.id]: event.target.value }))} placeholder="Spotify-Playlist-ID" />
                    <textarea value={addSongsByRound[round.id] ?? ''} onChange={(event) => setAddSongsByRound((prev) => ({ ...prev, [round.id]: event.target.value }))} placeholder={'Neue Songs ergänzen\nSong – Interpret'} />
                    <button type="button" className="button secondary small" onClick={() => onUpdateRound(round)}>Speichern</button>
                  </div>
                </td>
                <td><a href={publicPath} target="_blank" rel="noreferrer" className="button secondary small">Umfrage öffnen</a><div className="mono">{publicPath}</div></td>
                <td><div className="inline-actions">{!round.is_current && round.status !== 'ended' && <button className="button success small" type="button" onClick={() => onSetCurrent(round.id)}>Live setzen</button>}{round.status !== 'ended' && <button className="button danger small" type="button" onClick={() => onEndRound(round.id)}>Beenden</button>}</div></td>
              </tr>
            );
          })}
        </tbody></table></div>
      </section>

      <section className="two-col admin-columns">
        <article className="table-card elevated-card"><h2 className="section-title">Ergebnisse der aktuellen Runde</h2><p className="section-subtitle">Sortiert nach Gesamtpunkten. Gezählt werden nur bestätigte Stimmen.</p><div className="table-wrap"><table><thead><tr><th>#</th><th>Song</th><th>Gesamt</th><th>Ø Punkte</th><th>Gewählt</th></tr></thead><tbody>
          {leaderboard.length === 0 && <tr><td colSpan={5}><div className="empty-state">Noch keine bestätigten Stimmen vorhanden.</div></td></tr>}
          {leaderboard.map((row) => { const parts = splitSong(row.song); return <tr key={row.song}><td>{row.rank}</td><td><strong>{parts.title}</strong><div className="small-text">{parts.artist}</div></td><td>{row.totalPoints}</td><td>{row.averagePoints.toFixed(2)}</td><td>{row.voteCount}</td></tr>; })}
        </tbody></table></div></article>

        <article className="table-card elevated-card"><h2 className="section-title">Z-O-N-K-Auswertung</h2><p className="section-subtitle">Schlechtester Song der Woche, getrennt vom normalen Voting.</p><div className="table-wrap"><table><thead><tr><th>#</th><th>Song</th><th>Z-O-N-K Stimmen</th></tr></thead><tbody>
          {zonkLeaderboard.length === 0 && <tr><td colSpan={3}><div className="empty-state">Noch keine Z-O-N-K-Stimmen vorhanden.</div></td></tr>}
          {zonkLeaderboard.map((row) => <tr key={row.song}><td>{row.rank}</td><td><strong>{row.title}</strong><div className="small-text">{row.artist}</div></td><td>{row.count}</td></tr>)}
        </tbody></table></div></article>
      </section>

      <section className="table-card elevated-card"><h2 className="section-title">Letzte Stimmen</h2><div className="table-wrap"><table><thead><tr><th>Name</th><th>E-Mail</th><th>Status</th><th>Z-O-N-K</th><th>Zeitpunkt</th></tr></thead><tbody>
        {recentVotes.length === 0 && <tr><td colSpan={5}><div className="empty-state">Noch keine Stimmen vorhanden.</div></td></tr>}
        {recentVotes.map((vote) => <tr key={vote.id}><td>{vote.juror_name || '—'}</td><td>{vote.juror_email || '—'}</td><td><span className={`status-chip ${vote.is_verified ? 'live' : 'draft'}`}>{vote.is_verified ? 'Bestätigt' : 'Unbestätigt'}</span></td><td>{vote.zonk_song || '—'}</td><td>{formatDateTime(vote.created_at)}</td></tr>)}
      </tbody></table></div></section>
    </main>
  );
}
