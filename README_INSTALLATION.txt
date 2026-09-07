KNALLHART SERVIERT – JURY: ZONK / EINZELNE SONGWAHL

Neu:
- Jury kann zusätzlich zur Top-12-Punktewertung optional einen einzelnen ZONK-Song wählen.
- Die Auswahl ist unabhängig von der 12-bis-1-Punktewertung.
- Bereits gespeicherter ZONK wird beim erneuten Öffnen der Jury-Seite vorausgewählt.
- Beim Aktualisieren des Jury-Votings kann auch der ZONK geändert oder wieder entfernt werden.

WICHTIG – SUPABASE:
Vor dem Deploy bitte einmal die Datei
sql/sql_jury_zonk_vote.sql
im Supabase SQL Editor ausführen.

Danach die übrigen Dateien in GitHub am identischen Pfad ersetzen.

Geänderte Dateien:
- components/JuryVotingForm.tsx
- app/jury-voting/[token]/page.tsx
- app/api/jury-voting/submit/route.ts
- lib/juryVoting.ts

Neue SQL-Datei:
- sql/sql_jury_zonk_vote.sql

Hinweis:
Die bestehende Top-12-Auswahl war bereits vorhanden. Dieses Update ergänzt die
zusätzliche einzelne Songwahl (ZONK) für Juroren.
