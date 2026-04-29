# KHS Voting – Schema-Fix für Supabase

## Problem

Beim Anlegen einer Umfrage erscheint:

```text
null value in column "start_at" of relation "release_voting_rounds" violates not-null constraint
```

Ursache: Die Supabase-Tabelle `release_voting_rounds` enthält vermutlich alte und neue Spaltennamen gleichzeitig:

- alt: `start_at`, `end_at`, `results_public`
- neu: `starts_at`, `ends_at`, `is_public_results`

Der aktuelle App-Code nutzt die neuen Spalten. Die alte Spalte `start_at` ist aber noch als `NOT NULL` vorhanden und blockiert neue Einträge.

## Lösung

1. Supabase öffnen
2. `SQL Editor` öffnen
3. `New Query` anklicken
4. Inhalt aus `sql_fix_rounds_latest.sql` komplett einfügen
5. `Run` ausführen
6. In Vercel neu deployen:
   - `Deployments`
   - letzte Version öffnen
   - `Redeploy`

## Wichtige Erwartung nach dem SQL-Fix

In der Kontrollausgabe der Tabelle `release_voting_rounds` sollen diese Spalten existieren:

```text
starts_at
ends_at
is_public_results
```

Diese alten Spalten sollen nicht mehr auftauchen:

```text
start_at
end_at
results_public
```

## Danach testen

1. `/admin/release-voting` öffnen
2. neue Umfrage anlegen
3. prüfen, ob ein Link wie `/release-voting/neue-songs-der-woche-...` erzeugt wird
4. Voting-Seite öffnen
5. Teststimme abgeben
6. Mail bestätigen
7. Ergebnis prüfen
