KNALLHART SERVIERT – FINALE LOGIK FÜR DURCHSCHNITTSWERTE

Es gibt bewusst ZWEI verschiedene Durchschnittswerte:

1) Ø PUBLIKUM
   Wird in der Publikumswertung und in der Voting-/Songübersicht angezeigt.

   Formel:
   Summe aller Punkte aus den einzelnen gewerteten Publikumsstimmen für den Song
   ÷ Anzahl aller gewerteten Publikumsstimmen.

   Wird ein Song in einer Publikumsstimme nicht in die Top 12 gewählt,
   zählt diese Stimme für den Song mit 0 Punkten.

2) Ø PUNKTE / GESAMTWERTUNG
   Wird in "Gesamtwertung Jury + Publikum" und den Gesamt-Statistiken angezeigt.

   Formel:
   Gesamtpunkte
   ÷ Anzahl der tatsächlich eingegangenen Wertungsquellen.

   Dabei gilt:
   - jede abgegebene Jury-Wertung = 1 Wertungsquelle
   - das Publikum = genau 1 aggregierte Wertungsquelle
   - nicht abgegebene Juroren werden NICHT als 0 mitgezählt

   Beispiel:
   Jury-Punkte zusammen: 22
   Publikumspunkte der offiziellen 12–1-Wertung: 12
   Gesamtpunkte: 34
   4 abgegebene Juroren + Publikum = 5 Wertungsquellen
   Ø Punkte = 34 / 5 = 6,8

WICHTIG:
- "Gesamtpunkte" bleiben weiterhin die Summe aus Jury-Punkten + offiziellen Publikumspunkten.
- Keine Datenbankmigration nötig.
- Die Statistik-Exporte enthalten nun ebenfalls "Ø Punkte Gesamtwertung" und "Ø Publikum".
- Öffentliche reine Publikums-Ergebnislisten sind zur Klarheit mit "Ø Publikum" beschriftet.

INSTALLATION IN GITHUB:
1. ZIP entpacken.
2. Im GitHub-Repository jeweils zum gleichen Ordnerpfad gehen.
3. Die vorhandene Datei durch die Datei aus dieser ZIP ersetzen.
4. Commit speichern.

Wenn du eine der vorherigen Versionen bereits eingebaut hast:
Bitte ALLE Dateien aus dieser ZIP erneut ersetzen. Damit ist die Logik auf dem finalen Stand.
