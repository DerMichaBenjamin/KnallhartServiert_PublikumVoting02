-- Optionaler Sicherheits-Fix nach Bereinigung bestehender Doppler.
-- Erst ausführen, wenn vorhandene doppelte Songs im Backend zusammengeführt sind.

-- 1) Verhindert exakt gleiche Songs pro Umfrage mit anderer Groß-/Kleinschreibung oder Leerzeichen.
create unique index if not exists release_voting_songs_round_title_artist_unique_idx
on public.release_voting_songs (
  round_id,
  lower(regexp_replace(trim(title), '\s+', ' ', 'g')),
  lower(regexp_replace(trim(coalesce(artist, '')), '\s+', ' ', 'g'))
);

-- 2) Verhindert, dass dieselbe E-Mail-Adresse in einer Umfrage mehrere bestätigte Stimmen hat.
-- Mehrere offene/unbestätigte Versuche bleiben möglich, damit Nutzer eine abgelaufene Mail neu anfordern können.
create unique index if not exists release_voting_votes_one_verified_email_per_round_idx
on public.release_voting_votes (
  round_id,
  lower(trim(juror_email))
)
where is_verified = true;

notify pgrst, 'reload schema';
