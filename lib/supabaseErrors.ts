type DatabaseErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Supabase/PostgREST-Fehler sind nicht immer echte Error-Instanzen. Diese
 * Funktion bewahrt deshalb die eigentliche Datenbankmeldung für Adminhinweise,
 * statt sie durch eine nichtssagende Sammelmeldung zu ersetzen.
 */
export function describeDatabaseError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return text(error) || 'Unbekannter Datenbankfehler';

  const candidate = error as DatabaseErrorLike;
  const message = text(candidate.message);
  const details = text(candidate.details);
  const hint = text(candidate.hint);
  const code = text(candidate.code);
  const parts = [message, details && details !== message ? details : '', hint ? `Hinweis: ${hint}` : ''].filter(Boolean);
  return `${parts.join(' · ') || 'Unbekannter Datenbankfehler'}${code ? ` (${code})` : ''}`;
}

export function databaseError(label: string, error: unknown) {
  return new Error(`${label}: ${describeDatabaseError(error)}`);
}

