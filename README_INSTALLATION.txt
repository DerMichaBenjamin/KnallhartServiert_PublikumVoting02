KNALLHART SERVIERT – KORREKTUR PUBLIKUMSDURCHSCHNITT

Diese ZIP ersetzt die vorherige Umsetzung von „Ø Punkte“.

Richtige Definition:
Ø Publikum = Summe der Punkte, die ein Song aus allen GEWERTETEN Publikums-Votings erhalten hat
             / Anzahl der GEWERTETEN Publikums-Votings.

Wenn ein Song in einer Publikumsstimme nicht in den Top 12 gewählt wurde,
zählt diese Stimme für diesen Song mit 0 Punkten.

WICHTIG:
- Das ist NICHT der Durchschnitt aus Jury + Publikum.
- Es ist keine Datenbankmigration nötig.
- Die vorhandene Leaderboard-Berechnung row.avg wird verwendet.

INSTALLATION IN GITHUB:
1. ZIP entpacken.
2. Im GitHub-Repository jeweils zum gleichen Ordnerpfad gehen.
3. Die vorhandene Datei durch die Datei aus dieser ZIP ersetzen.
4. Commit speichern.

Wenn du die vorherige falsche Version bereits eingebaut hast:
Bitte ALLE Dateien aus dieser ZIP erneut ersetzen. Insbesondere
lib/combinedVotingResults.ts setzt die versehentlich ergänzte Gesamt-Durchschnittslogik zurück.
