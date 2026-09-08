KNALLHART SERVIERT – ERGEBNISSE IN 3 UNTERSEITEN

NEUE STRUKTUR
Unter "Ergebnisse" gibt es jetzt eine übersichtliche Auswahl:
1. Juryergebnisse
2. Publikumsstimmen
3. Gesamtwertung

URLs:
- /admin/release-voting/[roundId]/results
- /admin/release-voting/[roundId]/results/jury
- /admin/release-voting/[roundId]/results/public
- /admin/release-voting/[roundId]/results/overall

JURYERGEBNISSE
- einzelne Wertungskarten aller Jurymitglieder
- Publikum weiterhin als virtuelle 12-bis-1-Stimme dabei
- unter jeder persönlichen Jurywertung steht jetzt der gewählte ZONK
- beim Publikum steht der führende Publikums-ZONK
- zusätzliche Songtabelle:
  * Punkte jedes einzelnen Jurors pro Song
  * Publikum 12–1 zum Vergleich
  * Jury-Gesamtpunkte
  * Ø Jury
- Ø Jury = Jury-Gesamtpunkte / tatsächlich abgegebene Jurystimmen
- nicht platzierte Songs zählen innerhalb einer abgegebenen Jurystimme mit 0

PUBLIKUMSSTIMMEN
- Publikumsranking
- Publikumspunkte
- Ø Publikum
- Anzahl "Gewählt"
- Anteil
- virtuelle 12–1-Punkte
- Publikums-ZONK-Auswertung

GESAMTWERTUNG
- einzelne Punkte jedes Jurymitglieds pro Song
- Jury gesamt
- Ø Jury
- Publikumspunkte
- Gesamtpunkte
- Ø Gesamt
- Gesamt-ZONK mit Publikum / Jury / Gesamt

DRUCKEN
- jede der drei Unterseiten hat einen eigenen Druckbutton
- Jury- und Gesamtansichten werden für die Druckausgabe auf A4 Querformat optimiert
- /results?print=1 wird aus Kompatibilitätsgründen auf /results/overall?print=1 weitergeleitet

NAVIGATION
- Der bisherige Top-Level-Menüpunkt "Gesamtauswertung" heißt zur besseren Abgrenzung jetzt "Bericht / Export".
- Die neue "Gesamtwertung" befindet sich innerhalb von "Ergebnisse".

DATENBANK
- Keine neue Supabase-Migration nötig.
- Voraussetzung: Das vorherige Jury-ZONK-Update mit zonk_song_id ist bereits installiert.

GEÄNDERTE / NEUE DATEIEN
- app/admin/release-voting/[roundId]/results/page.tsx
- app/admin/release-voting/[roundId]/results/results.module.css
- app/admin/release-voting/[roundId]/results/jury/page.tsx
- app/admin/release-voting/[roundId]/results/public/page.tsx
- app/admin/release-voting/[roundId]/results/overall/page.tsx
- components/admin/ResultsSubNav.tsx
- components/admin/PrintCurrentPageButton.tsx
- components/admin/ResultsJuryCards.tsx
- components/admin/JuryResultsTable.tsx
- components/admin/ResultsPublicTable.tsx
- components/admin/DetailedOverallResultsTable.tsx
- components/admin/RoundViewNav.tsx
- lib/zonkResults.ts

INSTALLATION
1. ZIP entpacken.
2. Alle Dateien in GitHub am identischen Pfad hochladen/ersetzen.
3. Commit speichern.
4. Vercel neu deployen.

HINWEIS
Die TypeScript/TSX-Dateien wurden syntaktisch geprüft. Die Änderung ist bewusst so gebaut,
dass die bestehende Berichts-/Exportseite separat erhalten bleibt.
