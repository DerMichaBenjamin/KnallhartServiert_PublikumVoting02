# Jury-Voting – Stufe 1

Diese Version ergänzt das bestehende Publikums-Voting um ein separates Jury-Voting.

## Enthalten

- exakt 12 Jury-Plätze mit 12 bis 1 Punkt
- separate Jury-Stimmen; Publikum bleibt unverändert
- persönliche, nicht erratbare Links pro Juror und Voting-Runde
- Standardjuroren: Banjee, DJ Marcus Aurelius, Micha Benjamin
- beliebig viele Gastjuroren pro Runde
- Juroren können ihre abgegebene Rangliste bis zur Schließung erneut bearbeiten
- Admin zeigt den Abgabestatus von Publikum und allen Juroren
- Jury-Voting kann manuell geschlossen werden
- optionale separate Jury-Deadline; wenn leer, gilt das normale Enddatum der Runde
- Admin kann persönliche Links öffnen/kopieren, ersetzen oder einen Juror entfernen

## Einmalige Supabase-Migration

1. Supabase öffnen
2. `SQL Editor -> New Query`
3. Inhalt aus `sql_jury_voting_stage1.sql` einfügen
4. `Run`
5. Danach die aktualisierte App deployen

Die neuen Tabellen sind RLS-geschützt. Zugriff erfolgt wie beim bestehenden System serverseitig über `SUPABASE_SERVICE_ROLE_KEY`.

## Nutzung

1. Im Backend eine Release-Voting-Runde öffnen.
2. Im neuen Bereich **Jury-Voting** auf **Standardjuroren hinzufügen** klicken.
3. Weitere Gäste per Namen anlegen.
4. Persönlichen Link des jeweiligen Jurors kopieren und verschicken.
5. Optional Jury-Deadline setzen oder das Jury-Voting manuell schließen.

Die Gesamtmatrix und die Verrechnung mit dem Publikums-Ergebnis sind bewusst noch nicht enthalten; das ist Stufe 2.
