import { supabaseAdmin } from './supabase';

export type ImpressumData = {
  title: string;
  content: string;
  updated_at?: string;
};

export const DEFAULT_IMPRESSUM: ImpressumData = {
  title: 'Impressum',
  content: `Angaben gemäß § 5 TMG / § 18 MStV

Bitte im Admin-Bereich vollständig ausfüllen und rechtlich prüfen lassen.

Betreiber:
[Name / Firma]
[Straße und Hausnummer]
[PLZ Ort]
[Deutschland]

Kontakt:
E-Mail: [E-Mail-Adresse]
Telefon: [Telefonnummer, falls gewünscht]

Vertreten durch:
[Name der verantwortlichen Person]

Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV:
[Name]
[Adresse]

Umsatzsteuer-ID:
[falls vorhanden]

Haftung für Inhalte:
Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden.

Haftung für Links:
Diese Website kann Links zu externen Websites enthalten. Auf deren Inhalte haben wir keinen Einfluss. Für diese fremden Inhalte übernehmen wir keine Gewähr.

Urheberrecht:
Die durch den Betreiber erstellten Inhalte und Werke auf dieser Website unterliegen dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung und Verbreitung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung.`
};

export async function getImpressum(): Promise<ImpressumData> {
  try {
    const { data, error } = await supabaseAdmin()
      .from('legal_pages')
      .select('title, content, updated_at')
      .eq('slug', 'impressum')
      .maybeSingle();
    if (error || !data) return DEFAULT_IMPRESSUM;
    return data as ImpressumData;
  } catch {
    return DEFAULT_IMPRESSUM;
  }
}
