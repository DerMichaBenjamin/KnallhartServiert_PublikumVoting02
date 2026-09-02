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
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  return `${valueByType.get('year')}-${valueByType.get('month')}-${valueByType.get('day')}T${valueByType.get('hour')}:${valueByType.get('minute')}`;
}

export function dateTimeLocalToIso(value: FormDataEntryValue | string | null) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const targetUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let timestamp = targetUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(timestamp));
    const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value || 0);
    const representedUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
    timestamp += targetUtc - representedUtc;
  }
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
