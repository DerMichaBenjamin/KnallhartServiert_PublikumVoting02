KNALLHART SERVIERT – KÜNSTLERVERZEICHNIS: KOLLABORATIONEN AUFTEILEN

Geändert:
- lib/artistNames.ts (neu)
- lib/releaseVoting.ts
- components/admin/ArtistInstagramManager.tsx
- components/Top5GraphicGenerator.tsx

Was wird behoben?
- Mehrere Künstler in einem Song-Artist-Feld werden nicht mehr als zusätzlicher Sammel-Künstler geführt.
- Beispiel:
  "Andi Schiebt Anders, DJ Chris Caramello, DJ Cashi"
  wird zu:
  - Andi Schiebt Anders
  - DJ Chris Caramello
  - DJ Cashi
- Ebenso werden Kollaborationen mit feat., ft., featuring, x, +, / und ; getrennt.
- Doppelte Künstler werden anhand des normalisierten Künstlernamens zusammengeführt.
- "&" und "und" werden bewusst NICHT automatisch getrennt, damit feste Act-Namen wie
  "2 Engel & Charlie" nicht versehentlich zerlegt werden.
- Auch die Instagram-Zuordnung in der Top-5-/Top-12-Grafik verwendet dieselbe Aufteilungslogik.
- Beim nächsten Speichern des Künstlerverzeichnisses werden alte zusammengesetzte Labels nicht wieder mitgespeichert.

Stand Handle-Import:
- Die im Repository vorhandene Importdatei data/live-auftritte-instagram-handles-2026-09-06.csv
  enthält weiterhin nur 100 Künstler plus Kopfzeile und endet alphabetisch bei Leza.
- Deshalb ist die zweite Hälfte M–Z weiterhin NICHT automatisch importiert.
- Ohne vollständige Quelldatei bzw. zugängliche Künstler-/Instagram-Datenquelle werden keine Handles erfunden.

Installation:
1. ZIP entpacken.
2. Die enthaltenen Dateien mit gleicher Ordnerstruktur ins Repository hochladen/ersetzen.
3. Vercel-Deployment abwarten.
4. Backend > Künstler & Instagram öffnen und einmal "Alle Instagram-Tags speichern" klicken,
   damit eventuell früher gespeicherte Sammel-Künstler aus dem Verzeichnis bereinigt werden.

Keine Supabase-Migration nötig.
