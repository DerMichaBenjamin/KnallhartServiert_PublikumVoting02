-- KHS Voting: aktuelle Umfrage eindeutig machen
-- Ausführen in Supabase: SQL Editor -> New Query -> Run

-- Falls versehentlich mehrere Umfragen als aktuell markiert sind,
-- bleibt nur die zuletzt aktualisierte/angelegte aktuelle Umfrage aktiv.
with ranked as (
  select
    id,
    row_number() over (
      order by coalesce(updated_at, created_at, now()) desc, created_at desc, id desc
    ) as rn
  from public.release_voting_rounds
  where is_current = true
)
update public.release_voting_rounds r
set is_current = false,
    updated_at = now()
from ranked
where r.id = ranked.id
  and ranked.rn > 1;

-- Optionaler Schutz: künftig maximal eine aktuelle Umfrage.
create unique index if not exists release_voting_only_one_current_idx
on public.release_voting_rounds ((is_current))
where is_current = true;

notify pgrst, 'reload schema';

select id, title, slug, status, starts_at, ends_at, is_current, updated_at
from public.release_voting_rounds
order by is_current desc, updated_at desc nulls last, created_at desc;
