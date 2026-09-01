'use client';

import { useMemo, useState } from 'react';
import type { AdminRoundSummary, Round, Song } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { findSongDuplicateGroups } from '@/lib/releaseVotingShared';
import { adminRoundStatusLabel, formatRoundPeriod, getAdminRoundStatus } from '@/lib/adminUi';
import { PageHeader, StatCard, StatusBadge } from '@/components/admin/AdminUi';
import VotingCheckCard from '@/components/admin/VotingCheckCard';
import JuryOverview from '@/components/admin/JuryOverview';
import SongManagement from '@/components/admin/SongManagement';
import PublicVotingSummary from '@/components/admin/PublicVotingSummary';
import RoundSettingsPanel from '@/components/admin/RoundSettingsPanel';
import Top5GraphicGenerator from '@/components/Top5GraphicGenerator';

type Props = { round: Round; songs: Song[]; summary: AdminRoundSummary; isCurrentDj: boolean; juryData: AdminJuryRoundData; top5TemplateDataUrl?: string };

export default function AdminRoundDetail({ round, songs, summary, isCurrentDj, juryData, top5TemplateDataUrl = '' }: Props) {
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null); const [busy, setBusy] = useState(false);
  const activeJurors = juryData.jurors.filter((juror) => juror.is_active); const submittedJurors = activeJurors.filter((juror) => Boolean(juror.submitted_at));
  const duplicates = useMemo(() => findSongDuplicateGroups(songs), [songs]); const openJurors = activeJurors.length - submittedJurors.length;
  async function post(url: string, body: unknown) { setBusy(true); setMessage(null); try { const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await response.json().catch(() => null); if (!response.ok || !data?.ok) throw new Error(data?.error || 'Ungültige Server-Antwort.'); setMessage({ type: 'ok', text: 'Gespeichert.' }); window.location.reload(); return true; } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unbekannter Fehler.' }); return false; } finally { setBusy(false); } }
  function copyUrl(path: string, text: string) { const origin = typeof window !== 'undefined' ? window.location.origin : ''; void navigator.clipboard?.writeText(`${origin}${path}`); setMessage({ type: 'ok', text }); }

  return <main>
    <PageHeader eyebrow={<a href="/admin/rounds">← Zur Übersicht</a>} title={round.title} description={formatRoundPeriod(round)} actions={<><StatusBadge status={getAdminRoundStatus(round)}>{adminRoundStatusLabel(getAdminRoundStatus(round))}</StatusBadge><a className="ks-button secondary" href="#round-settings">Zeitraum bearbeiten</a><a className="ks-button primary" href={`/admin/release-voting/${round.id}/results`}>Zur Auswertung</a></>} />
    {message && <div className={`notice ${message.type === 'ok' ? 'success' : 'error'}`}>{message.text}</div>}{busy && <div className="notice">Speichert…</div>}
    <section className="ks-stats-grid dashboard"><StatCard label="Songs" value={songs.length} /><StatCard label="Jury-Mitglieder" value={activeJurors.length} /><StatCard label="Jury abgegeben" value={submittedJurors.length} tone={openJurors ? 'warning' : 'success'} /><StatCard label="Publikumsstimmen" value={summary.totalVotes} /><StatCard label="Gewertet" value={summary.countedVotes} tone="success" /><StatCard label="Nicht bestätigt" value={summary.unverifiedVotes} tone="warning" /><StatCard label="Ausgeschlossen" value={summary.excludedVotes} tone="danger" /></section>
    <VotingCheckCard roundId={round.id} reviewVotes={summary.reviewVotes} duplicateGroups={duplicates.length} openJurors={openJurors} />
    <section className="ks-quick-grid detail"><a className="ks-quick-action" href="#jury"><strong>Jury-Voting verwalten</strong><span>{submittedJurors.length}/{activeJurors.length} abgegeben</span><b>→</b></a><a className="ks-quick-action" href={`/admin/release-voting/${round.id}/votes`}><strong>Publikums-Voting verwalten</strong><span>{summary.totalVotes} Stimmen</span><b>→</b></a><a className={`ks-quick-action ${summary.reviewVotes ? 'accent' : ''}`} href={`/admin/release-voting/${round.id}/security`}><strong>Voting-Prüfung</strong><span>{summary.reviewVotes} Stimmen in Prüfung</span><b>→</b></a><a className="ks-quick-action" href={`/admin/release-voting/${round.id}/results`}><strong>Auswertung anzeigen</strong><span>Jury + Publikum</span><b>→</b></a><a className="ks-quick-action" href="#songs"><strong>Song hinzufügen</strong><span>Songliste erweitern</span><b>→</b></a></section>
    <JuryOverview round={round} juryData={juryData} post={post} copyUrl={copyUrl} />
    <Top5GraphicGenerator round={round} songs={songs} publicLeaderboard={summary.leaderboard} publicVerifiedVotes={summary.countedVotes} juryData={juryData} initialTemplateDataUrl={top5TemplateDataUrl} />
    <SongManagement round={round} songs={songs} summary={summary} juryData={juryData} post={post} />
    <PublicVotingSummary round={round} summary={summary} />
    <section className="ks-card ks-link-panel"><div><h2>Öffentliche und interne Links</h2><p>Vorhandene Publikums-, DJ-, Ergebnis- und Backend-Direktlinks.</p></div><div className="ks-inline-actions"><a className="ks-button secondary" href={`/release-voting/${round.slug}`} target="_blank" rel="noreferrer">Publikumsseite öffnen</a><button className="ks-button secondary" type="button" onClick={() => copyUrl(`/release-voting/${round.slug}`, 'Publikums-Link kopiert.')}>Publikums-Link kopieren</button><a className="ks-button secondary" href={`/dj-voting/${round.slug}`} target="_blank" rel="noreferrer">DJ-Seite öffnen</a><button className="ks-button secondary" type="button" onClick={() => copyUrl(`/dj-voting/${round.slug}`, 'DJ-Link kopiert.')}>DJ-Link kopieren</button>{isCurrentDj && <><a className="ks-button secondary" href="/dj-voting" target="_blank" rel="noreferrer">Aktuelles DJ-Voting</a><button className="ks-button secondary" type="button" onClick={() => copyUrl('/dj-voting', 'Aktueller DJ-Link kopiert.')}>Aktuellen DJ-Link kopieren</button></>}{round.is_public_results && <><a className="ks-button secondary" href={`/ergebnisse/${round.slug}`} target="_blank" rel="noreferrer">Öffentliches Ergebnis</a><button className="ks-button secondary" type="button" onClick={() => copyUrl(`/ergebnisse/${round.slug}`, 'Ergebnis-Link kopiert.')}>Ergebnis-Link kopieren</button></>}<button className="ks-button secondary" type="button" onClick={() => copyUrl(`/admin/release-voting/${round.id}`, 'Backend-Direktlink kopiert.')}>Backend-Link kopieren</button></div></section>
    <RoundSettingsPanel round={round} isCurrentDj={isCurrentDj} post={post} />
  </main>;
}
