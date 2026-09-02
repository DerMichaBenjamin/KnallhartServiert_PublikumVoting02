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

## Gezielte Korrekturen nach dem Redesign

- Die Voting-Prüfung unterscheidet jetzt echte Security-Auffälligkeiten, noch nicht gewertete Stimmen, mögliche Song-Doppler und offene Jury-Mitglieder. Jede Kategorie führt direkt in den passenden Arbeitsbereich.
- Gesamtanzahlen werden mit exakten Supabase-Count-Abfragen ermittelt. Dadurch enden Song- und Stimmenzahlen nicht mehr am Standard-Row-Limit von 1000.
- Die Umfragenübersicht lädt nur die sichtbare Seite mit acht Runden und nur deren benötigte Kennzahlen. Die globale Umfragenzahl unterscheidet alle Datenbankeinträge von Runden mit tatsächlich vorhandenen Publikums- oder abgegebenen Jury-Stimmen.
- Dashboard und Umfragedetail verwenden eine leichte Datenabfrage ohne vollständige Teilnehmerliste. Die Publikumsverwaltung lädt die Teilnehmerdaten weiterhin gezielt, wenn sie tatsächlich benötigt werden.
- Die Songliste kann nach Publikum, Jury-Durchschnitt und Gesamtpunkten sortiert werden. Der Jury-Durchschnitt ist nur eine Anzeige- und Sortierkennzahl; die Gesamtwertung bleibt die Summe der bisherigen Jury- und Publikumspunkte.
- Die Top-5-Grafik verwendet bereinigte Vorlagen ohne alte Songtexte. Eine veraltete gespeicherte Data-URL wird ohne die neue Vorlagenkennung `clean-v2` nicht mehr verwendet. Die Canvas-Erzeugung startet erst, wenn sich der Top-5-Bereich dem sichtbaren Bereich nähert.
- Der Zeitraum wird oben im Umfragedetail in einem Dialog bearbeitet; öffentliche Links stehen dort ebenfalls kompakt bereit. Temporäre Aktionsmenüs schließen bei Außenklick, Escape, Aktionswahl und beim Öffnen eines anderen Menüs.

## Vercel: IP-basierte Voting-Prüfung aktivieren

In **Vercel → Settings → Environment Variables** muss die Variable `VOTING_IP_HASH_SECRET` mit einem langen, kryptografisch zufälligen Secret angelegt werden. Anschließend ist ein Redeploy erforderlich.

Es wurde bewusst kein Dummywert in den Code eingebaut. Alte Stimmen ohne IP-Hash können nachträglich keinen echten IP-Hash erhalten; die Variable wirkt nur für zukünftige Stimmen, die danach erfasst werden.

## Einordnung der früher angezeigten „40 Umfragen“

Die 40 waren nicht hart codiert. Der bisherige Code zeigte `rounds.length` und damit jeden von Supabase zurückgegebenen Datensatz aus `release_voting_rounds`, ohne zwischen Entwurf, Test, unbenutzter Runde und tatsächlich durchgeführtem Voting zu unterscheiden. Es werden keine Runden gelöscht und keine Titelheuristiken verwendet. Die neue Übersicht zeigt die exakte Zahl aller Datenbankeinträge und zusätzlich datenbasiert, wie viele davon mindestens eine Publikumsstimme oder eine abgegebene Jury-Wertung besitzen.

## Bewusste Einschränkung

„Song deaktivieren“ ist nur als deaktivierte UI-Aktion markiert. Im vorhandenen Schema existiert kein nicht-destruktiver Aktivstatus für Songs. Deshalb wurde weder eine Migration noch eine Löschfunktion als Ersatz eingebaut.

## Prüfung

`npm run build` läuft erfolgreich durch. Login, geschützte Admin-Routen, Logout und die unveränderten öffentlichen Hauptrouten wurden lokal per HTTP geprüft. Datenbankgebundene Schreibvorgänge benötigen die produktiven Supabase-Umgebungsvariablen und sollten nach dem Einspielen in der Zielumgebung mit realen Runden verifiziert werden.
