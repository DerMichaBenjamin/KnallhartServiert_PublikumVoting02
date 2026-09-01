# Knallhart Serviert – Stage 3 Update: Top-5-Grafik erweitert

Dieses Update ergänzt die automatische Top-5-Grafik um folgende Punkte:

- eigene **Hintergrundgrafik hochladen** und dauerhaft speichern
- **auf Standardvorlage zurücksetzen**
- automatisch erzeugter **Social-Media-Text** mit Datum + Top 5
- deutliche **Warnung**, wenn die Grafik erzeugt wird, obwohl das Voting noch nicht abgeschlossen ist
- bessere Textplatzierung in der Grafik
- dynamischere Schriftanpassung bei langen Titeln / Künstlernamen

## Geänderte / neue Dateien

- `components/Top5GraphicGenerator.tsx`
- `components/AdminRoundDetail.tsx`
- `app/admin/release-voting/[roundId]/page.tsx`
- `app/api/admin/settings/route.ts`
- `app/globals.css`
- `README_STAGE3_TOP5_GRAFIK_UPDATE.md`

## Einbau

Diese Dateien in das bestehende Projekt übernehmen und neu deployen.

**Kein neues SQL nötig.**

Die neue Hintergrundgrafik wird in `app_settings` unter dem Key `top5_graphic_template_data_url` gespeichert.
