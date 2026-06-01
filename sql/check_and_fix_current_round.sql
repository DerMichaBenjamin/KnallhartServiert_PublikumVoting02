-- Kontrolle: Welche Umfrage ist aktuell als Hauptseite markiert?
select
  id,
  title,
  slug,
  status,
  is_current,
  starts_at,
  ends_at,
  updated_at
from public.release_voting_rounds
order by is_current desc, updated_at desc nulls last, created_at desc;

-- Optionaler manueller Fix:
-- 1. Ersetze unten DEIN-PUBLIKUMS-SLUG durch den Slug der normalen Publikums-Abstimmung.
-- 2. Entferne dann die Kommentarzeichen vor den UPDATE-Zeilen.

-- update public.release_voting_rounds
-- set is_current = false,
--     updated_at = now();

-- update public.release_voting_rounds
-- set is_current = true,
--     updated_at = now()
-- where slug = 'DEIN-PUBLIKUMS-SLUG';

-- notify pgrst, 'reload schema';
