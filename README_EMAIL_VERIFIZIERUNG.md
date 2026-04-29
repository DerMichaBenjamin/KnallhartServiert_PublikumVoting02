E-MAIL-BESTÄTIGUNG – SCHRITT FÜR SCHRITT

1. In Supabase im richtigen Projekt den Inhalt der Datei
   sql_vote_email_verification.sql
   im SQL Editor ausführen.

2. In GitHub diese Dateien durch die Versionen aus diesem Paket ersetzen:
   - lib/releaseVoting.ts
   - lib/emailVerification.ts
   - app/api/release-voting/submit/route.ts
   - app/release-voting/verify/page.tsx
   - app/release-voting/page.tsx
   - app/release-voting/[slug]/page.tsx
   - app/admin/release-voting/page.tsx
   - components/AdminDashboard.tsx
   - components/PublicVotingForm.tsx
   - app/globals.css

3. Prüfen, ob diese Vercel-Variablen gesetzt sind:
   - RESEND_API_KEY
   - RESEND_FROM_EMAIL
   - NEXT_PUBLIC_APP_URL
   - VOTE_VERIFY_SECRET

4. In Vercel neu deployen.

5. Danach testen:
   - Voting absenden
   - Mail öffnen
   - auf Bestätigungslink klicken
   - im Backend prüfen:
     abgegeben / bestätigt / unbestätigt

WICHTIG:
- Nur bestätigte Stimmen zählen in der Ergebnisliste.
- Die öffentliche Ergebnisliste erscheint erst nach Ende der Umfrage.
- Während die Umfrage live ist, wird kein Zwischenstand angezeigt.
