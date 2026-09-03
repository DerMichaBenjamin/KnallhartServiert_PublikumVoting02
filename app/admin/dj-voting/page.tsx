import { redirect } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/adminAuth';
import { getAdminJuryRoundData } from '@/lib/juryVoting';
import { getAdminDjParticipantRankings } from '@/lib/djVoting';
import { getAdminRoundDetailData, getCurrentDjRoundId, listRounds } from '@/lib/releaseVoting';
import { PageHeader, EmptyState } from '@/components/admin/AdminUi';
import DjVotingOverview from '@/components/admin/DjVotingOverview';
import { getHistoricalDjAggregatesForRound } from '@/lib/historicalJuryImport';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ roundId?: string }>;

export default async function AdminDjVotingPage({ searchParams }: { searchParams: SearchParams }) {
  if (!(await isAdminLoggedIn())) redirect('/admin/login');
  const [params, rounds, currentDjRoundId] = await Promise.all([searchParams, listRounds(), getCurrentDjRoundId()]);
  const requestedId = String(params.roundId || '').trim();
  const selected = rounds.find((round) => round.id === requestedId)
    || rounds.find((round) => round.id === currentDjRoundId)
    || rounds[0]
    || null;
  const [data, historicalDj] = selected
    ? await Promise.all([
      getAdminRoundDetailData(selected.id, { round: selected, channel: 'dj', includeParticipants: false }),
      getAdminJuryRoundData(selected.id, { role: 'dj' }),
    ])
    : [null, { defaultProfiles: [], jurors: [] }];

  return <main>
    <PageHeader title="DJ-Bewertungen" description="Separate DJ-Abstimmungen und historische DJ-Rankings. Diese Kategorie beeinflusst die normale Gesamtwertung nicht." actions={<a className="ks-button secondary" href="/dj-voting" target="_blank" rel="noreferrer">Öffentliches DJ-Voting öffnen ↗</a>} />
    <section className="ks-card ks-dj-round-picker">
      <form method="get"><label><span>Umfrage auswählen</span><select name="roundId" defaultValue={selected?.id || ''}>{rounds.map((round) => <option key={round.id} value={round.id}>{round.title}</option>)}</select></label><button className="ks-button primary" type="submit">Anzeigen</button></form>
      {selected && <small>{selected.id === currentDjRoundId ? 'Aktuell als DJ-Voting ausgewählt' : 'Historische/andere Umfrage'}</small>}
    </section>
    {!selected || !data ? <section className="ks-card"><EmptyState title="Keine Umfrage vorhanden" text="Lege zuerst eine Umfrage an oder wähle eine vorhandene Runde als DJ-Voting." /></section> : <DjVotingOverview data={data} historicalDj={historicalDj} historicalAggregates={await getHistoricalDjAggregatesForRound(selected, data.songs)} participants={await getAdminDjParticipantRankings(selected.id, data.songs)} />}
  </main>;
}
