'use client';

import type { Round } from '@/lib/releaseVotingShared';
import type { AdminJuryRoundData } from '@/lib/juryVoting';
import { dateTimeLocalToIso, formatAdminDateTime, toDateTimeLocal } from '@/lib/adminUi';
import { StatusBadge } from './AdminUi';
import PopoverMenu from './PopoverMenu';

type Post = (url: string, body: unknown) => Promise<boolean>;

export default function JuryOverview({ round, juryData, post, copyUrl }: { round: Round; juryData: AdminJuryRoundData; post: Post; copyUrl: (path: string, message: string) => void }) {
  const activeJurors = juryData.jurors.filter((juror) => juror.is_active);
  const submitted = activeJurors.filter((juror) => Boolean(juror.submitted_at)).length;

  return <section className="ks-card" id="jury">
    <div className="ks-section-heading">
      <div><span className="ks-section-kicker">Persönliche Zugänge</span><h2>Jury-Voting</h2><p>{submitted} von {activeJurors.length} abgegeben</p></div>
      <div className="ks-inline-actions">
        <StatusBadge status={round.jury_voting_closed ? 'danger' : 'success'}>{round.jury_voting_closed ? 'Geschlossen' : 'Offen'}</StatusBadge>
        <PopoverMenu label="Juror hinzufügen" trigger="Juror hinzufügen" triggerClassName="ks-button secondary" role="dialog" panelClassName="ks-form compact">
          {(close) => <>
            <button type="button" className="ks-button secondary" onClick={async () => { if (await post('/api/admin/jury', { action: 'add-defaults', roundId: round.id })) close(); }}>Standardjuroren ergänzen</button>
            <p className="ks-popover-help">Standard: {juryData.defaultProfiles.length ? juryData.defaultProfiles.map((profile) => profile.name).join(', ') : 'noch keine Profile vorhanden'}</p>
            <form className="ks-form compact" onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (await post('/api/admin/jury', { action: 'add-juror', roundId: round.id, name: form.get('jurorName') })) close();
            }}>
              <label>Gast / weiterer Juror<input name="jurorName" placeholder="Name" required /></label>
              <button className="ks-button primary" type="submit">Hinzufügen</button>
            </form>
          </>}
        </PopoverMenu>
        <PopoverMenu label="Jury-Einstellungen" trigger="Jury-Einstellungen" triggerClassName="ks-button secondary" role="dialog" panelClassName="ks-form compact">
          {(close) => <form className="ks-form compact" onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            if (await post('/api/admin/jury', { action: 'settings', roundId: round.id, closed: form.get('juryClosed') === 'on', endsAt: dateTimeLocalToIso(form.get('juryEndsAt')) })) close();
          }}>
            <label>Jury-Deadline<input name="juryEndsAt" type="datetime-local" defaultValue={toDateTimeLocal(round.jury_voting_ends_at)} /></label>
            <label className="ks-check"><input type="checkbox" name="juryClosed" defaultChecked={Boolean(round.jury_voting_closed)} /> Manuell schließen</label>
            <button className="ks-button primary" type="submit">Speichern</button>
          </form>}
        </PopoverMenu>
      </div>
    </div>
    <div className="ks-table-scroll">
      <table className="ks-table jury">
        <thead><tr><th>Name</th><th>Status</th><th>Fortschritt</th><th>Letzte Abgabe</th><th>Persönlicher Link</th><th></th></tr></thead>
        <tbody>
          {activeJurors.map((juror) => {
            const path = `/jury-voting/${juror.access_token}`;
            const progress = juror.items.length;
            return <tr key={juror.id}>
              <td><strong>{juror.display_name}</strong></td>
              <td>{juror.submitted_at ? <StatusBadge status="success">Abgegeben</StatusBadge> : <StatusBadge status="warning">Offen</StatusBadge>}</td>
              <td>{progress}/12</td>
              <td>{formatAdminDateTime(juror.vote_updated_at || juror.submitted_at)}</td>
              <td><div className="ks-inline-actions"><a className="ks-icon-button" href={path} target="_blank" rel="noreferrer" title="Jury-Seite öffnen" aria-label={`Jury-Seite für ${juror.display_name} öffnen`}>↗</a><button className="ks-icon-button" type="button" title="Persönlichen Link kopieren" aria-label={`Link für ${juror.display_name} kopieren`} onClick={() => copyUrl(path, `Jury-Link für ${juror.display_name} kopiert.`)}>⧉</button></div></td>
              <td><PopoverMenu label={`Aktionen für ${juror.display_name}`} trigger="•••" triggerClassName="ks-row-menu-trigger">
                {(close) => <>
                  <button type="button" onClick={() => { close(); if (window.confirm(`Neuen Link für ${juror.display_name} erzeugen? Der alte Link wird sofort ungültig.`)) void post('/api/admin/jury', { action: 'new-link', roundId: round.id, jurorId: juror.id }); }}>Neuen Link erzeugen</button>
                  <button type="button" className="danger" onClick={() => { close(); if (window.confirm(`${juror.display_name} entfernen? Eine vorhandene Jury-Stimme wird mit gelöscht.`)) void post('/api/admin/jury', { action: 'remove-juror', roundId: round.id, jurorId: juror.id }); }}>Juror entfernen</button>
                </>}
              </PopoverMenu></td>
            </tr>;
          })}
          {!activeJurors.length && <tr><td colSpan={6} className="ks-table-empty">Noch keine Juroren angelegt.</td></tr>}
        </tbody>
      </table>
    </div>
  </section>;
}
