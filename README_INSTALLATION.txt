KNALLHART SERVIERT – SENDUNGSAUSDRUCK V3
OPTIMIERTE A4-FLÄCHENNUTZUNG + GRÖSSERE LESBARKEIT

ÄNDERUNGEN

SEITE 1
- Die Zeilenhöhe der Ergebnismatrix wird jetzt dynamisch aus der Anzahl der Songs berechnet.
- Bei weniger Songs wird die Tabelle automatisch größer und füllt die Seite.
- Bei vielen Songs bleibt die Mindestschrift deutlich größer als bisher.
- Song und Künstler stehen im Ausdruck in einer gemeinsamen Zeile.
- Die Song-/Künstler-Spalte wurde verbreitert.
- Die drei Platzspalten G/J/P wurden etwas schmaler.
- Die Schnellübersicht oben wird im Ausdruck kompakter dargestellt, damit mehr Fläche
  für die eigentliche Ergebnistabelle zur Verfügung steht.
- Die alten Dense-Klassen dürfen die Schrift nicht mehr bis auf 4–5 pt verkleinern.

SEITE 2
- Die 12 einzelnen Wertungsplätze von Jury und Publikum bekommen deutlich größere
  Zeilen und größere Schrift.
- Songtitel und Künstler sind in den Einzelstimmen besser lesbar.
- Auch die kompakte Publikumstabelle ist größer gesetzt.
- Gesprächsanker/ZONK wurden platzsparender angeordnet, damit die eigentlichen
  Wertungslisten Vorrang haben.

ZIEL
Der Ausdruck soll die beiden A4-Querformatseiten möglichst vollständig ausnutzen
und aus typischem Podcast-Arbeitsabstand besser lesbar sein.

INSTALLATION
1. ZIP entpacken.
2. Die beiden Dateien in GitHub am identischen Pfad ersetzen.
3. Commit speichern.
4. Vercel neu deployen.
5. Danach "Ergebnisse -> Sendungsausdruck -> 2-Seiten-PDF / Drucken" testen.

Geänderte Dateien:
- components/admin/PodcastReport.tsx
- app/admin/release-voting/[roundId]/results/results.module.css

Prüfung:
- PodcastReport.tsx wurde syntaktisch mit TypeScript geprüft.
- Ein vollständiger Next-Build war in der lokalen Arbeitsumgebung nicht möglich,
  weil dort die Next.js-Abhängigkeiten nicht installiert waren.
