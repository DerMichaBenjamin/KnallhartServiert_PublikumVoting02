KNALLHART SERVIERT – ZONK-AUSWERTUNG

Neu auf der Admin-Ergebnisseite:

1. Unter JURY-VOTING
   - eigene ZONK-Auswertung der Jury
   - Rang, Song, Künstler, Anzahl Jury-ZONK-Stimmen

2. Unter PUBLIKUMS-VOTING
   - eigene ZONK-Auswertung des Publikums
   - Rang, Song, Künstler, Anzahl ZONK-Stimmen, Anteil

3. Unter GESAMTWERTUNG
   - Gesamt-ZONK Jury + Publikum
   - Spalten: Publikum | Jury | Gesamt
   - jede tatsächliche ZONK-Auswahl zählt genau eine Stimme
   - ZONK verändert NICHT die normale 12–1-/Gesamtpunktewertung

Gleichstände:
- Songs mit gleicher ZONK-Stimmenzahl erhalten denselben Rang.

Keine neue Supabase-Migration nötig.
Voraussetzung ist nur, dass die vorherige Jury-ZONK-Erweiterung bereits installiert ist
(zonk_song_id in release_voting_jury_votes).

Dateien:
- lib/zonkResults.ts (neu)
- components/admin/ResultsJuryCards.tsx
- components/admin/ResultsPublicTable.tsx
- components/admin/OverallResultsTable.tsx

Installation:
1. ZIP entpacken.
2. Dateien in GitHub an denselben Pfaden hochladen/ersetzen.
3. Commit speichern.
4. Vercel neu deployen.
