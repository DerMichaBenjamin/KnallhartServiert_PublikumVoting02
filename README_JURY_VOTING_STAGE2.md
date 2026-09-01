# Knallhart serviert – Jury-Voting Stufe 2

Stufe 2 ergänzt die Admin-Auswertung um die gemeinsame Wertung aus Jury und Publikum.

## Neu in Stufe 2

- Matrix mit allen Songs und den Punktespalten aller aktiven Juroren
- Publikum als eigener virtueller Juror
- Publikums-Top-12 erhält automatisch 12 bis 1 Punkt
- Umschaltung / Sortierung nach:
  - Gesamtwertung
  - Publikum
  - jedem einzelnen Juror
- separate Ranglistenansicht pro Juror bzw. Publikum
- Gesamtpunkte aus allen abgegebenen Jury-Wertungen + Publikum
- identische Gesamtpunktzahl = identischer Platz
- bei Gleichstand alphabetische Reihenfolge nach Songtitel, danach Künstler
- offene Jury-Wertungen werden sichtbar markiert und noch nicht addiert
- Statusübersicht: abgegebene Juroren, bestätigte Publikumsstimmen, Zahl der gewerteten Stimmen

## Berechnungslogik

### Jury
Jeder abgegebene Juror vergibt exakt 12 bis 1 Punkt. Nicht platzierte Songs erhalten 0 Punkte.

### Publikum
Die bereits vorhandene Publikumswertung wird nach den bestätigten Publikumsstimmen sortiert. Die ersten 12 Songs werden anschließend wie eine einzelne Jury-Stimme gewertet:

1. Platz = 12 Punkte
2. Platz = 11 Punkte
...
12. Platz = 1 Punkt

Bei identischer Publikums-Gesamtpunktzahl wird für die Vergabe dieser 12 bis 1 Punkte alphabetisch nach Songtitel und danach Künstler sortiert.

### Gesamtwertung
Alle abgegebenen Jury-Punkte und die virtuelle Publikumsstimme werden addiert. Haben mehrere Songs dieselbe Gesamtpunktzahl, erhalten sie denselben Rang (z. B. 1, 2, 2, 4). Innerhalb eines Gleichstands wird alphabetisch sortiert.

## Installation / Deployment

Für Stufe 2 ist **kein neues Supabase-SQL** nötig. Die Tabellen aus Stufe 1 reichen aus.

1. Dateien aus diesem Repository in GitHub übernehmen.
2. Vercel neu deployen.
3. Eine Voting-Runde im Adminbereich öffnen.
4. Unter dem Jury-Bereich erscheint die neue Sektion **„Gesamtwertung Jury + Publikum“**.

## Geänderte / neue Dateien

- `lib/juryVoting.ts`
  - lädt für die Adminansicht jetzt auch die einzelnen Jury-Punkte
- `components/JuryResultsMatrix.tsx`
  - neue Matrix-, Sortier- und Einzelranglisten-Ansicht
- `components/AdminRoundDetail.tsx`
  - bindet die neue Auswertung ein
- `app/globals.css`
  - Styles für Matrix und Auswertungsnavigation

## Hinweis zum Build

In der bereitgestellten Ausführungsumgebung waren die npm-Abhängigkeiten nicht lokal verfügbar. Ein vollständiger `next build` konnte deshalb dort nicht ausgeführt werden. Die Änderungen sind bewusst auf bestehende Tabellen und bestehende Datentypen aufgebaut und benötigen keine Schemaänderung.
