KNALLHART SERVIERT – SENDUNGSAUSDRUCK V4
FIREFOX-DRUCKMASSSTAB + GROSSE LESBARE SCHRIFT

AUSGANGSPROBLEM IM ECHTEN PDF
- Der komplette Ausdruck wurde von Firefox auf ca. 60–65 % verkleinert.
- Dadurch nutzte der Report nur den linken oberen Teil des A4-Blatts.
- Sehr viel Weißraum blieb rechts und unten ungenutzt.
- Gleichzeitig wurde die Tabelle wegen der vielen Songs zusätzlich extrem klein.
- Bei 43 Songs war die bisherige Mindest-Zeilenhöhe rechnerisch zu groß.

URSACHE
Firefox legt die Druckseite teilweise zunächst mit der Bildschirmbreite aus.
Ein 100%-Container kann dadurch breiter als A4 sein.
Firefox aktiviert dann "Shrink to fit" und verkleinert das komplette Dokument.

FIX
1. Die gesamte Druck-Ahnenkette wird auf exakt 287 mm gesetzt:
   A4 quer 297 mm minus 5 mm Rand links/rechts.
2. Dadurch muss Firefox die Seite nicht mehr auf ~65 % schrumpfen.
3. Beide Reportseiten verwenden die tatsächliche A4-Fläche.
4. Die 43 Song-Zeilen werden mathematisch auf die verfügbare Tabellenhöhe verteilt.
5. Die Schrift wird nicht mehr auf 4–5 pt reduziert.

NEUE SCHRIFTGRÖSSEN
SEITE 1:
- Songmatrix bei 43 Songs ca. 7,7 pt
- bei weniger Songs automatisch bis ca. 8,5 pt
- Künstler stehen gleich groß und kräftiger direkt beim Songtitel
- Tabellenkopf ca. 6,6 pt

SEITE 2:
- Songtitel der Einzelstimmen ca. 8 pt
- Künstler ca. 7 pt
- Spaltenüberschriften ca. 7,8 pt
- Publikumstabelle ca. 6,4 pt
- Gesprächsanker ebenfalls vergrößert

LAYOUT
- A4 Querformat
- 5 mm Seitenrand
- genau zwei Reportseiten
- Seite 1: Gesamt-/Jury-/Publikums-Matrix aller Songs
- Seite 2: Einzelstimmen Jury + Publikum, Publikumsdetails, Gesprächsanker, ZONK
- deutlich weniger ungenutzte Fläche

WEITERE PDF-KORREKTUR
- UI-Bezeichnungen verwenden im Report "12-1" statt eines typografischen Gedankenstrichs,
  um fehlerhafte Ersatzzeichen in einigen PDF-Renderern zu vermeiden.

INSTALLATION
1. ZIP entpacken.
2. Alle vier Dateien in GitHub am identischen Pfad ersetzen.
3. Commit speichern.
4. Vercel neu deployen.
5. Ergebnisse -> Sendungsausdruck öffnen.
6. 2-Seiten-PDF / Drucken.

EMPFOHLENE FIREFOX-DRUCKEINSTELLUNG
- Papier: A4
- Ausrichtung: Querformat
- Skalierung: 100 % oder "An Seitenbreite anpassen"
- Kopf- und Fußzeilen nach Möglichkeit deaktivieren
  (dadurch verschwinden URL, Datum und "1 von 2" am Seitenrand und es bleibt noch mehr Platz).

GEÄNDERTE DATEIEN
- components/admin/PodcastReport.tsx
- app/admin/release-voting/[roundId]/results/results.module.css
- app/admin/release-voting/[roundId]/results/podcast/page.tsx
- app/admin/admin.css

PRÜFUNG
- Beide geänderten TSX-Dateien wurden mit TypeScript syntaktisch geprüft.
- CSS-Klammerstruktur wurde geprüft.
