KNALLHART SERVIERT – FIX JURY-ZONK BUILD-FEHLER

Behobener Vercel/TypeScript-Fehler:
Property 'zonk_song_id' is missing in type ... but required in type 'AdminJuryJurorRow'.

Ursache:
Nach der Jury-ZONK-Erweiterung enthält AdminJuryJurorRow das Feld zonk_song_id.
lib/releaseStatistics.ts hat historische/aggregierte Jury-Datensätze aber noch ohne
dieses Feld aufgebaut.

Fix:
- StatisticsJuryVoteRow enthält jetzt zonk_song_id.
- Die Statistik-Abfrage für release_voting_jury_votes lädt zonk_song_id mit.
- Beim Aufbau von AdminJuryJurorRow wird zonk_song_id mitgegeben.

Installation:
1. ZIP entpacken.
2. In GitHub die Datei lib/releaseStatistics.ts durch diese Version ersetzen.
3. Commit speichern.
4. Vercel neu deployen.

Wichtig:
Die SQL-Datei aus dem vorherigen Jury-ZONK-Update
sql/sql_jury_zonk_vote.sql
muss in Supabase einmal ausgeführt worden sein, damit die Spalte zonk_song_id existiert.
