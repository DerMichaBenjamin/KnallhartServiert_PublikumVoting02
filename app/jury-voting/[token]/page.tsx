import Header from '@/components/Header';
import JuryVotingForm from '@/components/JuryVotingForm';
import SpotifySidebar from '@/components/SpotifySidebar';
import { formatDateTimeDE } from '@/lib/dateTime';
import { getJuryAccessData, JURY_PLACES_COUNT } from '@/lib/juryVoting';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getJuryAccessData(token);

  if (!data) {
    return (
      <main className="public-shell">
        <Header />
        <section className="card"><h1>Jury-Link ungültig</h1><p>Dieser persönliche Voting-Link existiert nicht oder wurde ersetzt.</p></section>
      </main>
    );
  }

  const deadline = data.round.jury_voting_ends_at || data.round.ends_at;
  const enoughSongs = data.songs.length >= JURY_PLACES_COUNT;
  const canEdit = data.isOpen && enoughSongs;

  return (
    <main className="voting-page">
      <SpotifySidebar playlistId={data.round.spotify_playlist_id} />
      <section className="voting-main">
        <Header />
        <h1>Knallhart serviert<br /><span>Jury-Voting</span></h1>
        <p>Dein persönlicher Link für den Release-Check. Die Bewertung ist getrennt vom Publikums-Voting.</p>

        <div className="status-grid">
          <div className="status-card"><small>Juror</small><b>{data.juror.display_name}</b></div>
          <div className="status-card"><small>Jury-Status</small><b>{canEdit ? (data.submittedAt ? 'Abgegeben · bearbeitbar' : 'Noch offen') : 'Geschlossen'}</b></div>
          <div className="status-card"><small>Deadline</small><b>{formatDateTimeDE(deadline)}</b></div>
          <div className="status-card"><small>Letzte Abgabe</small><b>{formatDateTimeDE(data.updatedAt || data.submittedAt)}</b></div>
        </div>

        {!enoughSongs && <div className="notice error">Diese Runde enthält weniger als 12 Songs. Das Jury-Voting kann erst genutzt werden, wenn mindestens 12 Songs vorhanden sind.</div>}
        {!data.isOpen && data.closeReason && <div className="notice">{data.closeReason}</div>}

        <JuryVotingForm
          accessToken={token}
          songs={data.songs}
          initialItems={data.items}
          jurorName={data.juror.display_name}
          canEdit={canEdit}
        />
      </section>
    </main>
  );
}
