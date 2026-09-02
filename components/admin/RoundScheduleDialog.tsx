'use client';

import { useEffect, useRef } from 'react';
import type { Round } from '@/lib/releaseVotingShared';
import { dateTimeLocalToIso, toDateTimeLocal } from '@/lib/adminUi';

type Post = (url: string, body: unknown) => Promise<boolean>;

export default function RoundScheduleDialog({ round, open, onClose, post }: { round: Round; open: boolean; onClose: () => void; post: Post }) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return <div className="ks-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panelRef} className="ks-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title" tabIndex={-1}>
      <div className="ks-modal-header">
        <div><span className="ks-section-kicker">Umfragezeitraum</span><h2 id="schedule-dialog-title">Zeitraum bearbeiten</h2></div>
        <button className="ks-icon-button" type="button" onClick={onClose} aria-label="Dialog schließen">×</button>
      </div>
      <form className="ks-form" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const saved = await post('/api/admin/round', {
          id: round.id,
          onlyUpdate: true,
          startsAt: dateTimeLocalToIso(form.get('startsAt')),
          endsAt: dateTimeLocalToIso(form.get('endsAt')),
        });
        if (saved) onClose();
      }}>
        <div className="ks-form-row two">
          <label>Start<input name="startsAt" type="datetime-local" defaultValue={toDateTimeLocal(round.starts_at)} required /></label>
          <label>Ende<input name="endsAt" type="datetime-local" defaultValue={toDateTimeLocal(round.ends_at)} required /></label>
        </div>
        <div className="ks-form-actions">
          <button className="ks-button secondary" type="button" onClick={onClose}>Abbrechen</button>
          <button className="ks-button primary" type="submit">Zeitraum speichern</button>
        </div>
      </form>
    </div>
  </div>;
}
