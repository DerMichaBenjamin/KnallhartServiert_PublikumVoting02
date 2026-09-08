KNALLHART SERVIERT – SENDUNGSAUSDRUCK V7
ROBUSTER FIX FÜR ABSCHNEIDEN + KÜNSTLERNAMEN

Im aktuellen PDF waren zwei Probleme sichtbar:

SEITE 1
- Die letzten Songs liefen unten in den Browser-Footer hinein.
- Ursache: Die feste Reporthöhe war größer als die tatsächlich nutzbare Druckhöhe,
  wenn Firefox/Chrome eigene Kopf-/Fußzeilen (URL, Datum, Seitenzahl) anzeigen.

SEITE 2
- Platz 12 und ZONK waren im PDF-Text vorhanden, wurden visuell aber vom unteren
  Block "Publikum kompakt" überdeckt.
- Lange Künstlernamen wurden in den Top-12-Zellen mit "…" abgeschnitten.

NEUE LÖSUNG
- Der Report benutzt beim Drucken eine sichere Höhe von 190 mm.
- Der interne Report-Footer wird ausgeblendet; die wichtigen Daten erhalten Vorrang.
- Seite 1:
  * alle Songzeilen bekommen eine feste, sichere Höhe
  * alle Songs bleiben oberhalb des Browser-Footers
  * Schrift bleibt ca. 7,45 pt
- Seite 2:
  * der Top-12-Bereich darf NICHT mehr schrumpfen
  * Plätze 1–12 erhalten garantiert je eine eigene Zeile
  * ZONK erhält danach eine eigene orange markierte 13. Zeile
  * Künstlernamen sind dunkel und fett
  * Künstlernamen dürfen auf bis zu zwei Zeilen umbrechen statt mit Ellipsis
    abgeschnitten zu werden
  * Songtitel bleiben klar in der ersten Zeile
- Der untere Bereich "Publikum kompakt / Gesprächsanker" wird nur enger gepackt,
  nicht über die Top-12-Wertung geschoben.

DATEIEN
- app/admin/layout.tsx
- app/admin/podcast-print-fix.css (neu)

WARUM EINE NEUE CSS-DATEI?
Der Fix ist jetzt bewusst komplett vom bisherigen großen Admin-/Ergebnis-CSS getrennt.
Er greift nur innerhalb von ".podcast-print-root". Dadurch ist er leichter zu warten
und kann andere Admin-Seiten nicht versehentlich verändern.

INSTALLATION
1. ZIP entpacken.
2. app/admin/layout.tsx in GitHub ersetzen.
3. app/admin/podcast-print-fix.css neu in GitHub anlegen.
4. Commit speichern.
5. Vercel neu deployen.
6. Ergebnisse -> Sendungsausdruck -> PDF/Drucken testen.

Keine Supabase-Änderung nötig.
