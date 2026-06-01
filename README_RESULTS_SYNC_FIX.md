# Ergebnis-Sync-Fix v26

Dieser Fix sorgt dafür, dass Backend- und Frontend-Auswertungen dieselbe frische Berechnung nutzen.

## Änderungen

- Supabase-Requests werden mit `cache: 'no-store'` ausgeführt.
- Ergebnis-, Voting- und Admin-Seiten sind explizit dynamisch und ohne Fetch-Cache.
- Backend-Detailseite, `/ergebnisse`, `/ergebnisse/[slug]` und `/release-voting/[slug]` verwenden dieselbe zentrale Auswertungslogik aus `lib/releaseVoting.ts` und `lib/releaseVotingShared.ts`.
- Nach Song-Merge wird die betroffene Umfrage über `updated_at` aktualisiert.
- Song-Merge bearbeitet Vote-Items nur noch für Stimmen der betroffenen Umfrage.
- Neue Detailseite: `/ergebnisse/[slug]` für einen eindeutigen Ergebnis-Direktlink pro Abstimmung.

## Einbau

1. ZIP entpacken.
2. Inhalt in den lokalen Projektordner kopieren und vorhandene Dateien ersetzen.
3. GitHub Desktop öffnen.
4. Commit: `Fix frontend backend result sync`
5. Push origin.
6. Vercel Deploy abwarten.
7. Backend und Frontend mit Strg+F5 neu laden.

## Test

- Backend-Detailseite einer Umfrage öffnen.
- Dort `Ergebnis öffnen` anklicken.
- Punkte/Gesamt/Ø/Gewählt müssen mit der Backend-Auswertung identisch sein.
