KNALLHART SERVIERT – 100 INSTAGRAM-HANDLES AUS LIVE-AUFTRITTE

Quelle:
Supabase-Export mit 100 Künstlern und 100 Instagram-Handles vom 06.09.2026.

Verhalten:
- Die 100 bestätigten Handles werden beim ersten Laden von /admin/artists automatisch
  als Startbestand in app_settings übernommen.
- Bereits vorhandene, manuell gepflegte Release-Check-Handles haben Vorrang.
- Der Seed wird nur einmal angewendet.
- Danach sind Änderungen und Löschungen im Release-Check maßgeblich und werden nicht
  beim nächsten Laden wieder überschrieben.
- Neue Künstler/Handles können weiterhin unter /admin/artists ergänzt werden.
- Top-5- und Top-12-Social-Media-Texte greifen automatisch auf dieses Verzeichnis zu.
- Bei mehreren Künstlern in einem Song werden vorhandene Einzel-Handles ebenfalls erkannt.

Keine Datenbankmigration erforderlich.

INSTALLATION:
1. ZIP entpacken.
2. Dateien in GitHub am identischen Pfad ersetzen/hochladen.
3. Commit speichern und Vercel deployen lassen.
4. Einmal /admin/artists öffnen. Dadurch wird der Startbestand übernommen.

Die Original-CSV liegt zusätzlich unter:
data/live-auftritte-instagram-handles-2026-09-06.csv
