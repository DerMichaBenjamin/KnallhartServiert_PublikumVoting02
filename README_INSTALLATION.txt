KNALLHART SERVIERT – BACKEND UPDATE
KÜNSTLER-MENÜ + HINTERGRUNDGRAFIK-UPLOAD ÜBERALL

Ausgangsbasis:
- das zuletzt hochgeladene Repository KnallhartServiert_PublikumVoting02-main(4).zip

Geändert wurden nur diese 3 Dateien:
- components/admin/AdminLayout.tsx
- components/Top5GraphicGenerator.tsx
- app/api/admin/settings/route.ts

ÄNDERUNG 1 – KÜNSTLER & INSTAGRAM IM LINKEN MENÜ
- Neuer fester Menüpunkt „Künstler & Instagram“
- Link: /admin/artists
- Eigene Künstler-Icon-Darstellung
- Die bereits vorhandene Künstlerverwaltung wird dadurch direkt erreichbar.

ÄNDERUNG 2 – HINTERGRUNDGRAFIK-UPLOAD ÜBERALL
Die Option „Neue Hintergrundgrafik hochladen“ wird jetzt im Release-Check-Grafikgenerator
auch in der kompakten Dashboard-Ansicht angezeigt – also überall dort, wo Top-5/Top-12-
Grafiken erzeugt bzw. heruntergeladen werden können.

Zusätzlich:
- Top 5 und Top 12 haben jeweils eine eigene gespeicherte Hintergrundvorlage.
- Beim Umschalten zwischen Top 5 und Top 12 wird die passende Vorlage verwendet.
- Eigene Top-12-Hintergrundgrafiken können jetzt ebenfalls hochgeladen, gespeichert
  und wieder auf Standard zurückgesetzt werden.
- Bestehende Top-5-Vorlagen bleiben unverändert kompatibel.
- Bei dynamischen Top-5-Sonderfällen/Gleichständen bleibt weiterhin die variable
  Standardvorlage aktiv, damit die automatisch erzeugten Zeilen korrekt funktionieren.

INSTALLATION
1. ZIP entpacken.
2. Die enthaltenen Dateien in GitHub an exakt denselben Pfaden ersetzen.
3. Commit speichern.
4. Vercel neu deployen lassen.

Keine Supabase-Migration nötig. Die neuen Top-12-Vorlagen werden wie die vorhandenen
Top-5-Vorlagen über app_settings gespeichert.

Prüfung:
- TypeScript/TSX-Syntax aller drei geänderten Dateien geprüft: ohne Syntaxfehler.
