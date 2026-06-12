V29 Hotfix: app_settings value-Spalte

Problem:
Beim Speichern des aktuellen DJ-Votings erscheint:
Could not find the 'value' column of 'app_settings' in the schema cache | PGRST204

Ursache:
Deine Supabase-Tabelle app_settings hat offenbar nicht die Spalte "value", sondern vermutlich "setting_value" oder eine ältere Struktur.

Fix:
/lib/settings.ts wurde so angepasst, dass beide Varianten unterstützt werden:
- key + value
- key + setting_value
- setting_key + setting_value

Einbau:
1. Datei /lib/settings.ts ersetzen.
2. Commit in GitHub Desktop: Fix app_settings schema compatibility
3. Push origin.
4. Vercel Deploy abwarten.
5. Adminseite hart neu laden und speichern.

SQL ist nicht nötig.
