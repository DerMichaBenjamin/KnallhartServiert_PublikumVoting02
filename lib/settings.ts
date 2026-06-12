import 'server-only';

import { getSupabaseAdminClient } from './supabaseAdmin';
export const DEFAULT_IMPRESSUM = `Impressum\n\nAngaben gemäß § 5 DDG\n\nMichael Teichert\nWorringer Str. 1\n50259 Pulheim\nDeutschland\n\nKontakt\n\nE-Mail: info@knallhart-serviert.de\n\nVerantwortlich für den Inhalt nach § 18 Abs. 2 MStV\n\nMichael Teichert\nWorringer Str. 1\n50259 Pulheim\nDeutschland\n\nVerbraucherstreitbeilegung\n\nWir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.\n\nHaftung für Inhalte\n\nAls Diensteanbieter sind wir für eigene Inhalte auf dieser Website nach den allgemeinen Gesetzen verantwortlich. Wir sind jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen dauerhaft zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.\n\nHaftung für Links\n\nDiese Website kann Links zu externen Websites Dritter enthalten. Auf deren Inhalte haben wir keinen Einfluss. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.\n\nUrheberrecht\n\nDie auf dieser Website erstellten Inhalte, Texte, Grafiken, Logos und sonstigen Bestandteile unterliegen dem deutschen Urheberrecht. Eine Vervielfältigung, Bearbeitung, Verbreitung oder sonstige Verwendung außerhalb der Grenzen des Urheberrechts bedarf der vorherigen schriftlichen Zustimmung des jeweiligen Rechteinhabers.`;

type SettingsSchema = {
  keyColumn: string;
  valueColumn: string;
};

const SETTINGS_SCHEMAS: SettingsSchema[] = [
  { keyColumn: 'key', valueColumn: 'value' },
  { keyColumn: 'key', valueColumn: 'setting_value' },
  { keyColumn: 'setting_key', valueColumn: 'setting_value' },
];

function isMissingColumnError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  const text = [e.code, e.message, e.details, e.hint].filter(Boolean).join(' ').toLowerCase();
  return text.includes('pgrst204') || text.includes('could not find') || text.includes('schema cache');
}

async function tryGetSetting(key: string, schema: SettingsSchema) {
  const sb = getSupabaseAdminClient();
  if (!sb) return { value: null as string | null, missingColumn: false };

  const { data, error } = await sb
    .from('app_settings')
    .select(schema.valueColumn)
    .eq(schema.keyColumn, key)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) return { value: null, missingColumn: true };
    return { value: null, missingColumn: false };
  }

  const raw = data?.[schema.valueColumn as keyof typeof data];
  return { value: raw == null ? null : String(raw), missingColumn: false };
}

export async function getSetting(key: string, fallback = '') {
  const sb = getSupabaseAdminClient();
  if (!sb) return fallback;

  for (const schema of SETTINGS_SCHEMAS) {
    const result = await tryGetSetting(key, schema);
    if (result.value != null) return result.value;
    if (!result.missingColumn) return fallback;
  }

  return fallback;
}

async function trySetSetting(key: string, value: string, schema: SettingsSchema, includeUpdatedAt: boolean) {
  const sb = getSupabaseAdminClient();
  if (!sb) throw new Error('Supabase fehlt');

  const payload: Record<string, string> = {
    [schema.keyColumn]: key,
    [schema.valueColumn]: value,
  };

  if (includeUpdatedAt) payload.updated_at = new Date().toISOString();

  const { error } = await sb
    .from('app_settings')
    .upsert(payload, { onConflict: schema.keyColumn });

  return error || null;
}

export async function setSetting(key: string, value: string) {
  const sb = getSupabaseAdminClient();
  if (!sb) throw new Error('Supabase fehlt');

  let lastError: unknown = null;

  for (const schema of SETTINGS_SCHEMAS) {
    let error = await trySetSetting(key, value, schema, true);
    if (!error) return;

    // Manche ältere app_settings-Tabellen haben kein updated_at.
    if (isMissingColumnError(error)) {
      lastError = error;
      error = await trySetSetting(key, value, schema, false);
      if (!error) return;
    }

    lastError = error;
    if (!isMissingColumnError(error)) throw error;
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('app_settings konnte nicht gespeichert werden. Prüfe die Spalten der Tabelle app_settings.');
}
