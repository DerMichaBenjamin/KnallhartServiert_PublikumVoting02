# Admin-Redesign

## Neue Admin-Routen

- `/admin/release-voting` – Dashboard
- `/admin/rounds` – Umfragenübersicht
- `/admin/rounds/new` – neue Umfrage
- `/admin/release-voting/[roundId]/votes` – Publikumsstimmen
- `/admin/release-voting/[roundId]/results` – interne Auswertung
- `/admin/statistics` – Gesamtstatistiken
- `/admin/impressum` – Impressum-Editor

## Daten- und Berechnungslogik

Es wurden keine Tabellen, Migrationen oder neuen Statusfelder angelegt. Die gemeinsame Jury-/Publikumsberechnung liegt jetzt in `lib/combinedVotingResults.ts` und wird von Ergebnisdarstellung, Songtabelle, `JuryResultsMatrix` und `Top5GraphicGenerator` verwendet.

`bestätigt`, `gewertet`, `in Prüfung`, `ausgeschlossen` und `unbestätigt` bleiben getrennte Zustände. Der Vote-Status-Endpunkt akzeptiert abwärtskompatibel einzelne `voteId`-Werte und die von der Oberfläche bereits vorgesehenen `voteIds`-Listen.

## Bewusste Einschränkung

„Song deaktivieren“ ist nur als deaktivierte UI-Aktion markiert. Im vorhandenen Schema existiert kein nicht-destruktiver Aktivstatus für Songs. Deshalb wurde weder eine Migration noch eine Löschfunktion als Ersatz eingebaut.

## Prüfung

`npm run build` läuft erfolgreich durch. Login, geschützte Admin-Routen, Logout und die unveränderten öffentlichen Hauptrouten wurden lokal per HTTP geprüft. Datenbankgebundene Schreibvorgänge benötigen die produktiven Supabase-Umgebungsvariablen und sollten nach dem Einspielen in der Zielumgebung mit realen Runden verifiziert werden.
