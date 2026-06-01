# Sicherheits- und Stabilitätsupdate für Knallhart serviert Publikums-Voting

Diese Version bündelt die wichtigsten produktionsnahen Fixes aus dem Review.

## Umgesetzt

- Next.js auf 15.5.18 aktualisiert.
- React/React-DOM im Lockfile auf 19.2.6 fixiert.
- `package-lock.json` ergänzt.
- Server-/Client-Grenze verbessert:
  - `lib/releaseVotingShared.ts` enthält nur Browser-sichere Typen und Hilfsfunktionen.
  - `lib/releaseVoting.ts` enthält Server-/Supabase-Zugriffe und nutzt `server-only`.
  - `lib/supabaseAdmin.ts`, `lib/settings.ts`, `lib/emailVerification.ts`, `lib/adminAuth.ts` nutzen `server-only`.
- Voting-Submit prüft jetzt, ob alle Song-IDs und die ZONK-ID wirklich zur aktuellen Umfrage gehören.
- Voting-Submit begrenzt Missbrauch:
  - max. 10 Submit-Versuche pro IP/Runde/Stunde im Server-Prozess
  - max. 3 Submit-Versuche pro E-Mail/Runde/Stunde im Server-Prozess und zusätzlich über vorhandene DB-Stimmen
  - nur eine bestätigte Stimme pro E-Mail/Runde
  - Honeypot-Feld gegen einfache Bots
- Private Ergebnisse werden über Direktlink nicht mehr angezeigt, solange `is_public_results` nicht aktiv ist.
- Bestätigungslinks werden nur noch aus `NEXT_PUBLIC_APP_URL` gebaut.
- Admin-Login hat Rate-Limit.
- Admin-Cookie ist nicht mehr nur ein deterministischer Passwort-Hash, sondern ein signierter Session-Token mit 24 Stunden Laufzeit.
- Admin-Cookie nutzt `sameSite: strict`.
- Admin-POST-Routen prüfen die Request-Origin.
- Neue Datenschutzseite `/datenschutz` ergänzt.
- Footer enthält Datenschutz + Impressum.
- Optionales SQL-Hardening ergänzt.

## Wichtig

Setze in Vercel unbedingt `NEXT_PUBLIC_APP_URL` auf deine echte öffentliche Domain ohne Unterpfad, z. B.:

```text
https://knallhart-serviert-publikum-voting.vercel.app
```

Nicht so:

```text
https://knallhart-serviert-publikum-voting.vercel.app/release-voting
```

Optional sinnvoll:

```text
ADMIN_SESSION_SECRET=ein-langer-zufaelliger-geheimer-wert
```

Wenn du `ADMIN_SESSION_SECRET` nicht setzt, nutzt die App als Fallback `VOTE_VERIFY_SECRET` oder `ADMIN_PASSWORD`.

## Optionales SQL

`sql_optional_security_hardening.sql` erst ausführen, wenn vorhandene doppelte Songs im Backend bereinigt sind. Sonst kann der Unique-Index wegen bestehender Doppler fehlschlagen.
