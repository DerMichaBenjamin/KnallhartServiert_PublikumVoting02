KNALLHART SERVIERT – SENDUNGSAUSDRUCK FÜR DEN PODCAST

NEU
- Eigene Ergebnisse-Unterseite „Sendungsausdruck“:
  /admin/release-voting/[roundId]/results/podcast
- Der Report sammelt alles, was für die Podcast-Aufzeichnung relevant ist, in einer festen Reihenfolge.
- Direkt auf der Ergebnisübersicht gibt es jetzt Buttons für:
  * PDF / Drucken (öffnet automatisch die Sendungsausdruck-Druckansicht)
  * kompletten Report als lange PNG-Datei herunterladen
- Die bisherige URL /results?print=1 führt jetzt ebenfalls zum Sendungsausdruck.

INHALT DES SENDUNGSAUSDRUCKS
1. Schnellblick
   - Gesamtsieger
   - Jury-Sieger
   - Publikumssieger
   - Gesamt-ZONK
   - größte Jury-/Publikumsabweichung
   - Abstand Platz 1–2
2. Gesamtwertung Jury + Publikum
   - Punkte jedes einzelnen Jurors pro Song
   - Jury gesamt
   - Ø Jury
   - Publikum 12–1
   - Gesamtpunkte
   - Ø Gesamt
3. Einzelne Jury-Wertungen
   - komplette Top 12 jedes Jurors
   - jeweiliger Jury-ZONK direkt darunter
   - Publikum als virtuelle 12–1-Stimme inklusive Publikums-ZONK
4. Song-Bewertungen im Vergleich
   - Gesamt-, Jury- und Publikumsplatz
   - Ø Jury
   - Ø Publikum
   - Ø Gesamt
   - Publikumsnennungen
   - Jury/Publikum-Abweichung
   - Polarisierung
5. Publikumsergebnis
   - Publikumspunkte
   - Ø Publikum
   - Nennungen / Anteil
   - offizielle 12–1-Punkte
6. ZONK-Auswertung
   - Publikum
   - Jury
   - Gesamt
7. Sendungsnotizen

DRUCK / PDF
- Der Report ist für A4 Querformat optimiert.
- Die Abschnitte beginnen bewusst auf neuen Druckseiten, damit Tabellen nicht unübersichtlich ineinanderlaufen.
- „PDF / Drucken“ öffnet die Browser-Druckansicht; dort „Als PDF speichern“ wählen.

PNG
- „Kompletten Report als PNG“ erstellt eine lange, zusammenhängende PNG-Datei mit denselben Kerninformationen.
- Keine zusätzliche Bibliothek und keine package.json-Änderung nötig.

INSTALLATION
1. ZIP entpacken.
2. Alle enthaltenen Dateien im GitHub-Repository am identischen Pfad ersetzen bzw. neu anlegen.
3. Commit speichern.
4. Vercel neu deployen.

DATENBANK
- Keine neue Supabase-Migration erforderlich.
- Voraussetzung: Die bisherigen Jury-/ZONK-Updates sind bereits installiert.

PRÜFUNG
- Alle neu/geänderten TypeScript-/TSX-Dateien wurden syntaktisch mit TypeScript transpiliert.
- Ein kompletter Next.js-Build war in der lokalen Umgebung nicht möglich, weil die npm-/Next-Abhängigkeiten dort nicht installiert sind.
