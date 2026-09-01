# Vote-Check / Fake-Voting-Prüfung – Stufe 2.1

Diese Änderung wird **auf den funktionierenden Jury-Stufe-2-Stand** aufgesetzt. Kein komplettes Repository austauschen.

## Reihenfolge

1. In Supabase im SQL Editor `sql_vote_integrity_stage21.sql` komplett ausführen.
2. Danach nur die unten genannten Dateien im Repository ersetzen/ergänzen.
3. Commit/Push und Vercel neu deployen.
4. Im Backend zuerst die Runde „Neue Songs … 28.08.26“ öffnen und die Statuszahlen kontrollieren.

## Ersetzen

- `lib/releaseVotingShared.ts`
- `lib/releaseVoting.ts`
- `lib/emailVerification.ts`
- `app/api/release-voting/submit/route.ts`
- `components/AdminRoundDetail.tsx`
- `components/AdminDashboard.tsx`
- `components/JuryResultsMatrix.tsx`
- `app/admin/release-voting/page.tsx`
- `app/globals.css`

## Neu anlegen

- `lib/voteIntegrity.ts`
- `app/api/admin/vote-status/route.ts`

## Supabase

- `sql_vote_integrity_stage21.sql`

Die Migration löscht keine Stimmen. Ein bereits vorhandenes `is_counted = false` wird nicht auf `true` zurückgesetzt. Dadurch sollen ältere „bestätigt, aber nicht gewertet“-Stimmen erhalten bleiben.

## Statuslogik

- **Unbestätigt**: Bestätigungslink noch nicht geklickt.
- **Gewertet**: bestätigt und `is_counted = true`.
- **Bestätigt · nicht gewertet / Prüfung**: bestätigt, automatisch auffällig oder früher schon als nicht gewertet markiert.
- **Ausgeschlossen**: manuell ausgeschlossen.
- **Gewertet · geprüft**: manuell freigegeben.

Nur **Gewertet** und **Gewertet · geprüft** fließen in Publikumsergebnis, ZONK und damit in den „Publikum“-Juror der Jury-Gesamtwertung ein.

## Automatische Prüfhilfen

Neue Stimmen bekommen serverseitig einen gehashten Verbindungswert (keine rohe IP im Backend) und einen Hash der Rangliste. Automatisch zur Prüfung gestellt werden insbesondere:

- erkannte Wegwerf-/Alias-E-Mail-Domains,
- identische Ranglisten über dieselbe Verbindung,
- 3 oder mehr bestätigte Stimmen über dieselbe Verbindung in einer Runde,
- starke Häufung von Voting-Versuchen über dieselbe Verbindung innerhalb einer Stunde.

Die automatische Erkennung ist bewusst nur ein **Prüfhinweis**. Sie schließt eine Stimme nicht endgültig aus. Im Backend kann sie mit `Werten` freigegeben oder mit `Ausschließen` endgültig ausgeschlossen werden.

## Bestehende Daten

Die SQL-Migration versucht alte Nicht-Wertungs-/Ausschlussinformationen zu erhalten. `atomicmail.io` und einige verbreitete Wegwerf-Domains werden bei bereits bestätigten Altstimmen vorsichtshalber auf **Prüfung / nicht gewertet** gesetzt, sofern sie nicht zuvor manuell freigegeben oder ausgeschlossen wurden.

Wenn eine ältere Installation bereits `client_ip_hash` oder `submit_ip_hash` hatte, wird dieser Wert nach `ip_hash` übernommen. Rohe IP-Adressen werden nicht neu gespeichert.

## Environment Variables

Keine neue Variable ist zwingend nötig. Der IP-Hash verwendet in dieser Reihenfolge:

1. `VOTE_INTEGRITY_SECRET`, falls gesetzt,
2. sonst `VOTE_VERIFY_SECRET`,
3. sonst `ADMIN_SESSION_SECRET` bzw. `ADMIN_PASSWORD`.

Optional kann in Vercel ein eigener stabiler `VOTE_INTEGRITY_SECRET` gesetzt werden. Wenn du das machst, danach nicht ständig ändern, sonst lassen sich neue IP-Hashes nicht mit älteren vergleichen.
