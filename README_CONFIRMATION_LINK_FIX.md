# Fix Bestätigungs-Mail-Link

Diese Version macht den Bestätigungslink robuster:

- Der Link wird aus der echten Request-Domain von Vercel gebaut.
- `NEXT_PUBLIC_APP_URL` wird nur noch als Fallback genutzt.
- Falls `NEXT_PUBLIC_APP_URL` versehentlich mit Pfad gespeichert ist, wird nur die Domain verwendet.
- Die Mail enthält zusätzlich einen kopierbaren Klartext-Link.
- Die Verifikation akzeptiert alte Token-Hashes ohne `VOTE_VERIFY_SECRET` und neue Token-Hashes mit Secret.

Wichtig: Bereits versendete kaputte Links mit falscher Domain/Pfad können nicht repariert werden. Nach dem Deploy dieser Version muss einmal neu abgestimmt werden, damit eine neue korrekte Mail rausgeht.
