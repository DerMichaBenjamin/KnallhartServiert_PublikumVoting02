export const APP_TIME_ZONE = 'Europe/Berlin';

export function formatDateTimeDE(value?: string | null) {
  if (!value) return 'offen';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'offen';
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: APP_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}
