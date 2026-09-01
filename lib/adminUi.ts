import type { Round } from './releaseVotingShared';

export type AdminRoundStatus = 'active' | 'planned' | 'ended';

export function getAdminRoundStatus(round: Pick<Round, 'status' | 'starts_at' | 'ends_at'>): AdminRoundStatus {
  if (round.status === 'ended') return 'ended';
  if (round.status === 'live') return 'active';
  return 'planned';
}

export function adminRoundStatusLabel(status: AdminRoundStatus) {
  if (status === 'active') return 'Aktiv';
  if (status === 'ended') return 'Abgeschlossen';
  return 'Geplant';
}

export function formatAdminDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(date);
}

export function formatAdminDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(date);
}

export function formatRoundPeriod(round: Pick<Round, 'starts_at' | 'ends_at'>) {
  return `${formatAdminDateTime(round.starts_at)} – ${formatAdminDateTime(round.ends_at)}`;
}

export function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function dateTimeLocalToIso(value: FormDataEntryValue | string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
