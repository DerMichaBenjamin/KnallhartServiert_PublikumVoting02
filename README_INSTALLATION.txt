KNALLHART SERVIERT – SONGS INSGESAMT: GLOBALE UNIQUE-LOGIK

Geändert:
- app/admin/rounds/page.tsx
Neu:
- lib/uniqueSongCount.ts

Neue Berechnung für "Songs insgesamt":
- derselbe Song in mehreren Wochen zählt nur 1x
- doppelte Datenbankeinträge zählen nur 1x
- Groß-/Kleinschreibung, Leerzeichen, Satzzeichen und Umlaute werden normalisiert
- entscheidend ist die Kombination aus Songtitel + Künstler

WICHTIG:
Versionsangaben bleiben Bestandteil des Titels.
Deshalb zählen z. B. separat:
- "Mon Amour"
- "Mon Amour (Hüttenmix)"
- "Mon Amour Remix"
- "Mon Amour (Radio Edit)"

Die bestehende allgemeine Dublettenprüfung wird hierfür absichtlich NICHT verwendet,
weil sie Versionsbegriffe teilweise entfernt und dadurch Original + Remix fälschlich
zusammenfassen könnte.

Die Anzeige auf "Umfragen" erhält zusätzlich den Hinweis:
"Eindeutige Titel + Künstler · gleiche Songs über mehrere Wochen nur 1×"

Keine Supabase-Migration nötig.

Installation:
1. ZIP entpacken.
2. app/admin/rounds/page.tsx ersetzen.
3. lib/uniqueSongCount.ts neu anlegen.
4. Commit speichern und Vercel deployen.
