KNALLHART SERVIERT – KÜNSTLER & INSTAGRAM-VERZEICHNIS

Repository-Prüfung Live-Auftritte:
- aktueller GitHub-Stand geprüft
- hochgeladene ZIP geprüft
- Branch main geprüft
- Commit-Historie rund um die Künstler-Autovervollständigung geprüft

Ergebnis:
Im Repository ist keine Instagram-Handle-Liste hinterlegt.
Die Künstler-Autovervollständigung liest nur Künstlernamen aus events.title.
Es wurden daher KEINE Handles geraten oder erfunden.

NEU IM RELEASE-CHECK:
- separate Admin-Seite: /admin/artists
- alle Künstler aus allen Release-Check-Runden werden automatisch aufgelistet
- Instagram-Handles können zentral ergänzt/geändert werden
- neue Künstler können unabhängig von vorhandenen Runden angelegt werden
- mehrere Handles pro Künstler sind möglich
- Suche und Filter "Nur ohne Handle"
- Speicherung in app_settings; keine neue Datenbankmigration notwendig
- Top-5-/Top-12-Social-Media-Text nutzt das zentrale Verzeichnis automatisch
- Grafikbereich verlinkt auf das Künstlerverzeichnis
- NOCH KEIN Eintrag in der Seitenleiste; das kann später bewusst entschieden werden

INSTALLATION:
1. ZIP entpacken.
2. Dateien im GitHub-Repository an exakt denselben Pfaden ersetzen bzw. neue Dateien anlegen.
3. Commit speichern.
4. Vercel deployt danach automatisch.

Wenn die vorherige Top-12/Instagram-Version bereits eingebaut ist, reicht die UPDATE-ZIP.
