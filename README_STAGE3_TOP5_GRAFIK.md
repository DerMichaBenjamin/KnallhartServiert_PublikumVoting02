# Knallhart Serviert – Stage 3: automatische Top-5-Grafik

Diese Erweiterung baut auf **Stufe 2 + Vote-Check 2.1b** auf und fügt im Adminbereich einer Runde eine automatisch generierte **Top-5-Grafik** hinzu.

## Enthalten

- automatische Berechnung der **Gesamtwertung Jury + Publikum**
- das Publikum zählt weiterhin als **1 Juror** mit 12 bis 1 Punkten
- **Top 5** werden automatisch in die Social-Grafik gesetzt
- bei Gleichstand werden **alle Songs bis einschließlich Platz 5** dargestellt (also notfalls auch 6 oder mehr Einträge)
- Vorschau direkt im Backend
- **PNG-Download** im Instagram-Reels-Format **1080 × 1920**
- Grafik basiert auf der übergebenen **leeren Vorlage**

## Geänderte / neue Dateien

- `components/Top5GraphicGenerator.tsx` **neu**
- `components/AdminRoundDetail.tsx` **geändert**
- `app/globals.css` **ergänzt**
- `public/release-check-top5-template.png` **neu**

## Einbau

Einfach diese Dateien in das bestehende Projekt übernehmen und neu deployen.

**Kein neues SQL nötig.**

## Wo du es findest

Im Admin unter einer konkreten Voting-Runde erscheint unter der Jury-Gesamtwertung ein neuer Abschnitt:

**Top-5-Grafik**

Dort siehst du:

- die gerenderte Vorschau
- den vorgesehenen Dateinamen
- die enthaltenen Songs/Platzierungen
- einen Button **PNG herunterladen**

## Wichtige Logik

- Grundlage ist die **Gesamtwertung** aus Jury + Publikum
- Grundlage fürs Publikum sind nur **bestätigte und gewertete Stimmen**
- Stimmen in **Prüfung / nicht gewertet** oder **ausgeschlossen** fließen nicht ein
- Die Grafik kann schon vor dem Ende der Runde erzeugt werden, sinnvoll ist sie aber erst nach Abschluss aller Wertungen.
