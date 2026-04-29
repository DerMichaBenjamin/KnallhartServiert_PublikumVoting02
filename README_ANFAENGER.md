# Knallhart serviert Voting – Clean Rebuild

## 1. Supabase
SQL Editor öffnen und `supabase_clean_schema.sql` komplett ausführen.

## 2. GitHub
Alle Dateien aus diesem Ordner ins Repository hochladen/ersetzen.
Wichtig: In `public/` muss dein Logo als `khs-logo.png` liegen.

## 3. Vercel Environment Variables
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ADMIN_PASSWORD
- RESEND_API_KEY
- RESEND_FROM_EMAIL
- NEXT_PUBLIC_APP_URL
- VOTE_VERIFY_SECRET

## 4. Admin
/admin/login öffnen.

## 5. Funktionen
- öffentliche Ergebnisse: pro Umfrage im Backend aktivierbar
- Kontaktformular sendet an info@michabenjamin.de
- Impressum im Backend editierbar
- Spotify Playlist-ID pro Umfrage editierbar
- Songs nachträglich ergänzen
- ZONK getrennt ausgewertet
