# Voting-Behavior-Tracking – Einbau

Stand: 07.09.2026

## Bereits erledigt

Die benötigten Spalten wurden im Supabase-Projekt `Knallhart serviert Hörer-Abstimmung neu`
bereits angelegt. Die SQL-Datei unter `sql/add_voting_behavior_tracking.sql` ist deshalb in erster
Linie Repository-Dokumentation und muss nicht erneut ausgeführt werden.

## Dateien in GitHub ersetzen/anlegen

1. `components/PublicVotingForm.tsx` ersetzen
2. `app/api/release-voting/submit/route.ts` ersetzen
3. `app/datenschutz/page.tsx` ersetzen
4. `lib/votingBehavior.ts` neu anlegen
5. `sql/add_voting_behavior_tracking.sql` neu anlegen

## Was danach gespeichert wird

- vollständige zufällige Song-Anzeigereihenfolge (nur Song-IDs)
- chronologische erfolgreiche Song-Klicks (nur Song-IDs)
- ob die Suche benutzt wurde
- Anzahl der Verschiebungen in der Top-12
- Anzahl der entfernten Songs
- ungefähre Votingdauer
- Behavior-Score 0–100
- nachvollziehbare Behavior-Flags

## Wichtig

Der Behavior-Score ist nur ein Hinweis auf mechanisches/oberflächliches Füllverhalten.
Er verändert weder `is_counted` noch `integrity_status` und schließt keine Stimme automatisch aus.

Alte Stimmen funktionieren unverändert weiter und haben bei den neuen Spalten die vorhandenen Defaults.

## Nach Deployment prüfen

Nach dem ersten neuen Voting in Supabase kontrollieren:

```sql
select
  id,
  created_at,
  display_order,
  selection_order,
  search_used,
  move_count,
  remove_count,
  voting_duration_ms,
  behavior_score,
  behavior_flags
from public.release_voting_votes
where round_id = 'c9e66da7-7471-4309-b7cb-570759db5580'
order by created_at desc
limit 10;
```
