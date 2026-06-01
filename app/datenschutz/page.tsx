import Header from '@/components/Header';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function DatenschutzPage() {
  return (
    <main className="public-shell simple-page-shell">
      <Header />
      <section className="card simple-page-card legal-content">
        <h1>Datenschutzerklärung</h1>
        <p>
          Diese Datenschutzerklärung informiert über die Verarbeitung personenbezogener Daten im Rahmen der
          Knallhart-serviert-Publikums-Abstimmung.
        </p>

        <h2>Verantwortlicher</h2>
        <p>
          Michael Teichert<br />
          Worringer Str. 1<br />
          50259 Pulheim<br />
          E-Mail: info@knallhart-serviert.de
        </p>

        <h2>Welche Daten werden verarbeitet?</h2>
        <p>
          Beim Absenden eines Votings werden Name, E-Mail-Adresse, optionaler Instagram-Name, die abgegebene
          Song-Auswahl, eine optionale ZONK-Auswahl, Zeitpunkt der Abstimmung sowie der Bestätigungsstatus gespeichert.
        </p>

        <h2>Zweck der Verarbeitung</h2>
        <p>
          Die Daten werden verarbeitet, um die Teilnahme am Voting zu ermöglichen, Mehrfachabstimmungen zu begrenzen,
          die E-Mail-Bestätigung durchzuführen und das Ergebnis der Abstimmung korrekt auszuwerten.
        </p>

        <h2>E-Mail-Bestätigung</h2>
        <p>
          Nach dem Absenden wird eine Bestätigungs-E-Mail verschickt. Erst nach Bestätigung über den Link wird die Stimme
          als gültig gezählt. Nicht bestätigte Stimmen können intern sichtbar sein, fließen aber nicht in die öffentliche
          Auswertung ein.
        </p>

        <h2>Technische Dienstleister</h2>
        <p>
          Für Betrieb und Datenverarbeitung werden technische Dienstleister eingesetzt, insbesondere Vercel für Hosting,
          Supabase für Datenbankfunktionen und Resend für den Versand von E-Mails. Dabei können Daten auf Servern dieser
          Anbieter verarbeitet werden.
        </p>

        <h2>Rechtsgrundlage</h2>
        <p>
          Die Verarbeitung erfolgt, soweit anwendbar, auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO zur Durchführung und
          Absicherung des Votings sowie auf Grundlage deiner freiwilligen Teilnahme.
        </p>

        <h2>Speicherdauer</h2>
        <p>
          Voting-Daten werden nur so lange gespeichert, wie sie für die Durchführung, Nachvollziehbarkeit und Auswertung
          der Abstimmung erforderlich sind. Du kannst eine Löschung deiner personenbezogenen Daten anfragen.
        </p>

        <h2>Auskunft und Löschung</h2>
        <p>
          Du kannst Auskunft über gespeicherte personenbezogene Daten verlangen oder eine Löschung anfragen. Schreibe dafür
          an <a href="mailto:info@knallhart-serviert.de">info@knallhart-serviert.de</a>.
        </p>

        <h2>Hinweis</h2>
        <p>
          Diese Datenschutzerklärung ist ein praxisnaher Entwurf für die App. Für eine vollständig rechtssichere Fassung
          sollte sie juristisch geprüft und an die tatsächlich verwendeten Anbieter, Auftragsverarbeitungsverträge und
          Speicherdauern angepasst werden.
        </p>
      </section>
      <footer className="legal-footer"><Link href="/datenschutz">Datenschutz</Link><Link href="/impressum">Impressum</Link></footer>
    </main>
  );
}
