# DJ-Voting-Fix v28

Neu:

- `/dj-voting` zeigt immer die aktuell im Backend markierte DJ-Umfrage.
- Auf DJ-Seiten steht oben `DJ-Voting` statt `Publikums-Voting`.
- Beim Anlegen einer Umfrage gibt es die Checkbox `Als aktuelles DJ-Voting unter /dj-voting anzeigen`.
- Bei bestehenden Umfragen gibt es in den Einstellungen dieselbe Checkbox.
- Publikums-Hauptseite `/release-voting` und DJ-Hauptseite `/dj-voting` sind getrennt.
- Es ist kein SQL notwendig; die aktuelle DJ-Runde wird in `app_settings` gespeichert.
