KNALLHART SERVIERT – ARTIST INSTAGRAM SYNC FIX

Behoben:
1. Mickie/Micky Krause ergänzt:
   @mickie_krause_official

2. Micha Schue/Micha Schü ergänzt:
   @micha_schue

3. Die bisherige 500-Einträge-Grenze in der Settings-API wurde auf 5000 erhöht.
   Das ist wichtig, weil im Release-Check bereits deutlich mehr als 500 Künstler-
   Bezeichnungen vorkommen können.

4. Seed-Sync verbessert:
   Bisher wurde der Live-Auftritte-Seed nur EINMAL übernommen.
   Danach wurden spätere Seed-Ergänzungen nicht mehr automatisch nachgezogen.

   Neu:
   - Seed-/Importdaten werden beim Laden ergänzend gemerged.
   - Bereits manuell im Release-Check gepflegte Handles haben immer Vorrang.
   - Neue Seed-/Extra-Einträge werden automatisch nachgezogen.
   - Es wird nichts manuell Gepflegtes überschrieben.

WICHTIG:
Der ursprünglich im Repository vorhandene Live-Auftritte-Export enthält tatsächlich
nur 100 Künstler und endet alphabetisch bei "Leza". Die aktuell verbundene
Live-Auftritte-Codebasis enthält keine aktuelle Artists/Instagram-Tabelle, aus der
hier automatisch alle weiteren M–Z-Handles ausgelesen werden könnten.

Darum behebt dieses Update:
- den Speicher-/Importfehler,
- die beiden konkret fehlenden verifizierten Künstler,
- und die zukünftige Synchronisationslogik.

Die zwei Handles wurden außerdem bereits direkt im aktuellen Supabase-Bestand des
Release-Checks ergänzt. Nach Neuladen sollten sie also sofort erscheinen.

Dateien:
- app/api/admin/settings/route.ts
- lib/releaseArtistInstagramExtras.ts (neu)

Keine Supabase-Migration nötig.
