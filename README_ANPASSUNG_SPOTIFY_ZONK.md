# KHS Voting Patch – Spotify + Z-O-N-K + Mockup-Design

## Reihenfolge

1. In Supabase `sql_spotify_zonk_patch.sql` im SQL Editor ausführen.
2. Danach die Dateien aus diesem Paket 1:1 in GitHub ersetzen oder neu anlegen.
3. Committen.
4. Vercel-Deploy abwarten.
5. Neue Test-Abstimmung/Vote testen.

## Neue Funktionen

- Spotify-Playlist-Player im Hochkantformat.
- Spotify-Playlist-ID pro Umfrage im Admin pflegbar.
- Songs können nachträglich zur Umfrage ergänzt werden.
- Optionales Feld `Z-O-N-K – Song der Woche` im Frontend.
- Z-O-N-K-Auswertung getrennt im Backend und nach Abstimmungsende.
- Normale Top-12-Wertung bleibt unverändert: nur bestätigte Stimmen zählen.
- Fehlende Songs werden per Mail/Instagram gemeldet, kein eigenes Eingabefeld.

## Wichtig

Die SQL-Datei muss im richtigen Supabase-Projekt laufen. Sonst fehlen die neuen Spalten `spotify_playlist_id` und `zonk_song`.
