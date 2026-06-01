# Einbau-Anleitung v25

Diese ZIP basiert auf der zuletzt hochgeladenen GitHub-ZIP `KnallhartServiert_PublikumVoting02-main(1).zip` und ergänzt die Sicherheits- und Stabilitätsupdates.

## Wichtigste neue Vercel-Variable

In Vercel unter `Project -> Settings -> Environment Variables` muss gesetzt sein:

```text
NEXT_PUBLIC_APP_URL=https://knallhart-serviert-publikum-voting.vercel.app
```

Wichtig: ohne `/release-voting` am Ende.

Empfohlen zusätzlich:

```text
ADMIN_SESSION_SECRET=ein-langer-zufaelliger-geheimer-wert
```

## Einbau

1. ZIP entpacken.
2. Den kompletten entpackten Inhalt in deinen lokalen GitHub-Projektordner kopieren.
3. Vorhandene Dateien ersetzen lassen.
4. GitHub Desktop öffnen.
5. Commit erstellen, z. B. `Security hardening v25`.
6. `Push origin` klicken.
7. Vercel-Deploy abwarten.
8. Falls der Bestätigungslink nicht funktioniert: `NEXT_PUBLIC_APP_URL` prüfen und Redeploy ausführen.

## Optionales SQL

`sql_optional_security_hardening.sql` erst ausführen, wenn vorhandene Doppler bereinigt sind.
