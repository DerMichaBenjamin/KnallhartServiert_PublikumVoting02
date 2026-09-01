# Knallhart Serviert – Top-5-Grafik Update + Jury-Voting UI-Fix

Dieses Patch-Update ergänzt bzw. korrigiert:

- Social-Media-Text ergänzt automatisch die Hashtags
  - `#knallhartserviert #top5 #releasecheck #neuemusik #partyschlager`
- Songtitel und Künstlernamen in der Top-5-Grafik sitzen weiter vom Platz-Kreis entfernt und insgesamt mittiger im schwarzen Balken
- lange Titel / Künstler werden etwas defensiver skaliert
- Jury-Voting-UI klarer bedienbar:
  - gesamte Song-Zeile ist klickbar
  - zusätzlicher Button **Wählen**
  - deutlicher Hinweistext zur Bedienung
  - gespeicherte Jury-Wertung bleibt weiterhin bis Fristende bearbeitbar

## Geänderte Dateien

- `components/Top5GraphicGenerator.tsx`
- `components/JuryVotingForm.tsx`
- `app/globals.css`
