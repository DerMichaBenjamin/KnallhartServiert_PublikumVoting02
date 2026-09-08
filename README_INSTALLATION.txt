KNALLHART SERVIERT – SENDUNGSAUSDRUCK V2
GENAU ZWEI DIN-A4-SEITEN FÜR DEN PODCAST

ZIEL
Der Sendungsausdruck ist jetzt kein langer Web-Report mehr, sondern besteht beim
Drucken/PDF aus exakt zwei DIN-A4-Seiten im Querformat.

SEITE 1 – ERGEBNISMATRIX
- Schnellüberblick: Gesamt, Jury, Publikum, ZONK
- alle Songs in einer gemeinsamen Tabelle
- Gesamtplatz
- Juryplatz
- Publikumsplatz
- einzelne Punkte JEDES Jurymitglieds pro Song
- Jury-Punktesumme
- Ø Jury
- Publikum als virtuelle 12–1-Stimme
- Publikums-Rohpunkte aus allen gewerteten Einzelstimmen
- Ø Publikum
- Gesamtpunkte
- Ø Gesamt

SEITE 2 – EINZELSTIMMEN + PUBLIKUM
- Top 12 jedes einzelnen Jurymitglieds nebeneinander
- Publikum als eigene virtuelle 12–1-Stimme direkt daneben
- pro Platz ist die Punktzahl sofort erkennbar
- ZONK jedes Jurors
- Publikums-ZONK
- Publikum kompakt:
  * Rohpunkte
  * Ø Publikum
  * Anzahl "Gewählt"
  * Anteil
  * 12–1-Punkte
- Gesprächsanker: Gesamtsieger, Jury-Sieger, Publikumssieger,
  größte Jury-/Publikumsabweichung
- kompakte Gesamt-ZONK-Liste

DURCHSCHNITTSLOGIK
- Ø Jury = Jury-Punktesumme / tatsächlich abgegebene Jurystimmen.
  Nicht platzierte Songs zählen bei einer abgegebenen Jury-Stimme mit 0.
- Ø Publikum = Summe aller Punkte aus den gewerteten einzelnen Publikumsvotings
  / Anzahl der gewerteten Publikumsvotings. Nicht gewählt = 0.
- Ø Gesamt = Gesamtpunkte / tatsächlich gewertete Quellen
  (abgegebene Juroren + Publikum genau einmal).

PDF / DRUCK
- Button heißt jetzt "2-Seiten-PDF / Drucken".
- Der Druckdialog erzeugt exakt zwei A4-Querformatseiten.
- Im Browser kann dort "Als PDF speichern" gewählt werden.

PNG
- "2-Seiten-Report als PNG" erzeugt eine Datei mit beiden A4-Seiten
  untereinander in einem einzigen PNG.

AUTOMATISCHE DICHTE
Bei Wochen mit besonders vielen Songs wird die Ergebnismatrix automatisch
kompakter gesetzt, damit sie innerhalb der ersten A4-Seite bleibt.

DATENBANK
Keine neue Supabase-Migration nötig.

INSTALLATION
1. ZIP entpacken.
2. Alle enthaltenen Dateien in GitHub am identischen Pfad ersetzen/hochladen.
3. Commit speichern.
4. Vercel neu deployen.
5. Danach eine Umfrage -> Ergebnisse -> Sendungsausdruck öffnen.

Geänderte Dateien:
- lib/podcastReport.ts
- components/admin/PodcastReport.tsx
- components/admin/PodcastReportActions.tsx
- app/admin/release-voting/[roundId]/results/results.module.css
- app/admin/release-voting/[roundId]/results/page.tsx
- app/admin/release-voting/[roundId]/results/podcast/page.tsx

Prüfung:
Die geänderten TypeScript-/TSX-Dateien wurden syntaktisch mit TypeScript geprüft.
