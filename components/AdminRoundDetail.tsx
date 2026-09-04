'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import RoundScheduleDialog from '@/components/admin/RoundScheduleDialog';
import RoundLinksBar from '@/components/admin/RoundLinksBar';
import Top5GraphicGenerator from '@/components/Top5GraphicGenerator';
import RoundViewNav from '@/components/admin/RoundViewNav';
import ReportActions from '@/components/admin/ReportActions';
import { buildReleaseWeekStatistics, buildReportGraphicData } from '@/lib/releaseStatisticsCore';

type Props = {
  round: Round;
  songs: Song[];
  summary: AdminRoundSummary;
  isCurrentDj: boolean;
  juryData: AdminJuryRoundData;
  securityAlerts: number | null;
};

export default function AdminRoundDetail({ round, songs, summary, isCurrentDj, juryData, securityAlerts }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const activeJurors = juryData.jurors.filter((juror) => juror.is_active);
  const submittedJurors = activeJurors.filter((juror) => Boolean(juror.submitted_at));
  const duplicates = useMemo(() => findSongDuplicateGroups(songs), [songs]);
  const openJurors = activeJurors.length - submittedJurors.length;
  const openCheckItems = summary.reviewVotes + (securityAlerts || 0) + duplicates.length + openJurors;
  const statistics = useMemo(() => buildReleaseWeekStatistics(round, songs, summary, juryData), [round, songs, summary, juryData]);
  const graphicData = useMemo(() => buildReportGraphicData(statistics), [statistics]);

  async function post(url: string, body: unknown) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Ungültige Server-Antwort.');
      setMessage({ type: 'ok', text: typeof data.message === 'string' && data.message.trim() ? data.message : 'Gespeichert.' });
      router.refresh();
      return true;
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unbekannter Fehler.' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function copyUrl(path: string, text: string) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    void navigator.clipboard?.writeText(`${origin}${path}`);
    setMessage({ type: 'ok', text });
  }

  return <main>
    <PageHeader
      eyebrow={<a href="/admin/rounds">← Zur Übersicht</a>}
      title={round.title}
      description={formatRoundPeriod(round)}
      actions={<>
        <StatusBadge status={getAdminRoundStatus(round)}>{adminRoundStatusLabel(getAdminRoundStatus(round))}</StatusBadge>
        <button className="ks-button secondary" type="button" onClick={() => setScheduleOpen(true)}>Zeitraum bearbeiten</button>
      </>}
    />
    <RoundViewNav roundId={round.id} active="overview" />
    <ReportActions data={graphicData} view="overview" />
    {message && <div className={`notice ${message.type === 'ok' ? 'success' : 'error'}`}>{message.text}</div>}
    {busy && <div className="notice">Speichert…</div>}
    <RoundLinksBar round={round} copyUrl={copyUrl} />
    <section className="ks-stats-grid dashboard">
      <StatCard label="Songs" value={songs.length} />
      <StatCard label="Jury-Mitglieder" value={activeJurors.length} />
      <StatCard label="Jury abgegeben" value={submittedJurors.length} tone={openJurors ? 'warning' : 'success'} />
      <StatCard label="Publikumsstimmen" value={summary.totalVotes} />
      <StatCard label="Gewertet" value={summary.countedVotes} tone="success" />
      <StatCard label="Nicht bestätigt" value={summary.unverifiedVotes} tone="warning" />
      <StatCard label="Ausgeschlossen" value={summary.excludedVotes} tone="danger" />
    </section>
    <VotingCheckCard roundId={round.id} reviewVotes={summary.reviewVotes} securityAlerts={securityAlerts} duplicateGroups={duplicates.length} openJurors={openJurors} />
    <section className="ks-quick-grid detail">
      <a className="ks-quick-action" href="#jury"><strong>Jury-Voting verwalten</strong><span>{submittedJurors.length}/{activeJurors.length} abgegeben</span><b>→</b></a>
      <a className="ks-quick-action" href={`/admin/release-voting/${round.id}/votes`}><strong>Publikums-Voting verwalten</strong><span>{summary.totalVotes} Stimmen</span><b>→</b></a>
      <a className={`ks-quick-action ${openCheckItems ? 'accent' : ''}`} href={`/admin/release-voting/${round.id}/checks`}><strong>Voting-Prüfung</strong><span>{securityAlerts === null ? (openCheckItems ? `${openCheckItems} bekannte Prüfpunkte` : 'Prüfstatus öffnen') : openCheckItems ? `${openCheckItems} offene Prüfpunkte` : 'Keine offenen Prüfpunkte'}</span><b>→</b></a>
      <a className="ks-quick-action" href={`/admin/release-voting/${round.id}/results`}><strong>Auswertung anzeigen</strong><span>Jury + Publikum</span><b>→</b></a>
      <a className="ks-quick-action" href="#songs"><strong>Song hinzufügen</strong><span>Songliste erweitern</span><b>→</b></a>
    </section>
    <JuryOverview round={round} juryData={juryData} post={post} copyUrl={copyUrl} />
    <Top5GraphicGenerator round={round} songs={songs} publicLeaderboard={summary.leaderboard} publicVerifiedVotes={summary.countedVotes} juryData={juryData} />
    <SongManagement round={round} songs={songs} summary={summary} juryData={juryData} post={post} />
    <PublicVotingSummary round={round} summary={summary} />
    <RoundSettingsPanel round={round} isCurrentDj={isCurrentDj} post={post} />
    <RoundScheduleDialog round={round} open={scheduleOpen} onClose={() => setScheduleOpen(false)} post={post} />
  </main>;
}
