KNALLHART SERVIERT – ACCESSIBILITY-UPDATE
KÜNSTLERNAMEN DEUTLICH GRÖSSER UND LESBARER

ZIEL
Songtitel und Künstler sollen sowohl auf der Website als auch im Ausdruck
ohne gutes Nahsehen klar erkennbar sein. Künstlernamen werden nicht mehr
wie Kleingedrucktes behandelt.

1. JURY-VOTING-SEITE
Die Songliste wurde strukturiert:
- Songtitel eigene Zeile: 18 px, sehr fett
- Künstler eigene Zeile: 16 px, dunkel und fett
- größere Zeilenhöhe und mehr Abstand

In "Deine Top 12":
- Songtitel: 17 px
- Künstler: 15,5 px
- Punkte stehen separat rechts
- keine zusammengequetschte "Song — Künstler"-Zeile mehr

2. ADMIN / JURY-AUSWERTUNG
Bei den einzelnen Jury-Wertungskarten:
- Karten etwas breiter
- Songtitel ca. 14 px
- Künstler ca. 12,5 px, dunkler und kräftiger
- mehr Zeilenhöhe

Im Ausdruck der Jury-Auswertung:
- Songtitel ca. 8,5 pt
- Künstler ca. 7,7 pt
- Künstler deutlich dunkler und fett

3. SENDUNGSAUSDRUCK – WEBSITE
Auf der Bildschirmansicht:
- Hauptmatrix größer
- Künstler dunkler und kräftiger
- Einzelne Jury-Wertungen:
  Songtitel ca. 13,5 px
  Künstler ca. 12,5 px

4. SENDUNGSAUSDRUCK – PDF / DRUCK
Seite 1:
- Künstler bleibt wegen 43+ Songs inline, ist aber exakt gleich groß wie der Songtitel
- dunkler und fett

Seite 2:
- Jury-/Publikums-Einzelstimmen:
  Songtitel ca. 8,2 pt
  Künstler ca. 7,8 pt
- Künstler ist dunkel (#26364a) und fett statt grau/klein
- Zeilenhöhe leicht erhöht, damit beide Zeilen sauber Platz haben

Auch die kompakte Publikumstabelle zeigt Künstler kräftiger.

INSTALLATION
1. ZIP entpacken.
2. Alle 4 Dateien in GitHub am identischen Pfad ersetzen.
3. Commit speichern.
4. Vercel neu deployen.

GEÄNDERTE DATEIEN
- components/JuryVotingForm.tsx
- app/globals.css
- app/admin/admin.css
- app/admin/release-voting/[roundId]/results/results.module.css

PRÜFUNG
- JuryVotingForm.tsx wurde mit TypeScript syntaktisch geprüft.
- CSS-Klammerstruktur aller drei Stylesheets wurde geprüft.
- Keine neue Supabase-Migration erforderlich.
