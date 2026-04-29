-- KHS Voting: Supabase-Schema stabilisieren
-- Ziel: alte/neue Spaltennamen vereinheitlichen und Admin-Speichern reparieren.
-- Ausführen in Supabase: SQL Editor -> New Query -> Run

create extension if not exists pgcrypto;

-- 1) Tabellen sicherstellen
create table if not exists public.release_voting_rounds (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  places_count integer not null default 12,
  is_current boolean not null default false,
  is_public_results boolean not null default false,
  spotify_playlist_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.release_voting_songs (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.release_voting_rounds(id) on delete cascade,
  title text not null,
  artist text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.release_voting_votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.release_voting_rounds(id) on delete cascade,
  juror_name text not null,
  juror_email text not null,
  juror_instagram text,
  is_verified boolean not null default false,
  verified_at timestamptz,
  verify_token_hash text,
  verify_sent_at timestamptz,
  verify_expires_at timestamptz,
  zonk_song_id uuid references public.release_voting_songs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.release_voting_vote_items (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.release_voting_votes(id) on delete cascade,
  song_id uuid not null references public.release_voting_songs(id) on delete cascade,
  points integer not null
);

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

-- 2) Moderne Spalten nachrüsten, falls die Tabelle aus einer alten Version kommt
alter table public.release_voting_rounds add column if not exists slug text;
alter table public.release_voting_rounds add column if not exists title text;
alter table public.release_voting_rounds add column if not exists description text;
alter table public.release_voting_rounds add column if not exists status text not null default 'draft';
alter table public.release_voting_rounds add column if not exists starts_at timestamptz;
alter table public.release_voting_rounds add column if not exists ends_at timestamptz;
alter table public.release_voting_rounds add column if not exists places_count integer not null default 12;
alter table public.release_voting_rounds add column if not exists is_current boolean not null default false;
alter table public.release_voting_rounds add column if not exists is_public_results boolean not null default false;
alter table public.release_voting_rounds add column if not exists spotify_playlist_id text;
alter table public.release_voting_rounds add column if not exists created_at timestamptz not null default now();
alter table public.release_voting_rounds add column if not exists updated_at timestamptz not null default now();

alter table public.release_voting_songs add column if not exists artist text not null default '';
alter table public.release_voting_songs add column if not exists sort_order integer not null default 0;
alter table public.release_voting_songs add column if not exists created_at timestamptz not null default now();

alter table public.release_voting_votes add column if not exists juror_instagram text;
alter table public.release_voting_votes add column if not exists is_verified boolean not null default false;
alter table public.release_voting_votes add column if not exists verified_at timestamptz;
alter table public.release_voting_votes add column if not exists verify_token_hash text;
alter table public.release_voting_votes add column if not exists verify_sent_at timestamptz;
alter table public.release_voting_votes add column if not exists verify_expires_at timestamptz;
alter table public.release_voting_votes add column if not exists zonk_song_id uuid references public.release_voting_songs(id) on delete set null;

-- 3) Altdaten aus Legacy-Spalten übernehmen, falls vorhanden
-- Legacy: start_at/end_at/results_public -> modern: starts_at/ends_at/is_public_results
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'release_voting_rounds' and column_name = 'start_at'
  ) then
    execute 'update public.release_voting_rounds set starts_at = coalesce(starts_at, start_at::timestamptz) where starts_at is null and start_at is not null';
    execute 'alter table public.release_voting_rounds alter column start_at drop not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'release_voting_rounds' and column_name = 'end_at'
  ) then
    execute 'update public.release_voting_rounds set ends_at = coalesce(ends_at, end_at::timestamptz) where ends_at is null and end_at is not null';
    execute 'alter table public.release_voting_rounds alter column end_at drop not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'release_voting_rounds' and column_name = 'results_public'
  ) then
    execute 'update public.release_voting_rounds set is_public_results = coalesce(is_public_results, results_public::boolean) where results_public is not null';
    execute 'alter table public.release_voting_rounds alter column results_public drop not null';
  end if;
end $$;

-- 4) Legacy-Spalten entfernen, damit Supabase/PostgREST nicht mehr zwischen alten und neuen Namen driftet
alter table public.release_voting_rounds drop column if exists start_at;
alter table public.release_voting_rounds drop column if exists end_at;
alter table public.release_voting_rounds drop column if exists results_public;

-- 5) Pflichtwerte und Indizes stabilisieren
update public.release_voting_rounds
set title = coalesce(nullif(title, ''), 'Neue Songs der Woche')
where title is null or title = '';

update public.release_voting_rounds
set slug = lower(regexp_replace(coalesce(nullif(slug, ''), 'voting-' || left(id::text, 8)), '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null or slug = '';

-- Falls es durch alte Testdaten doppelte Slugs gibt, werden sie vor dem Unique-Index eindeutig gemacht.
with duplicates as (
  select id, slug, row_number() over (partition by slug order by created_at, id) as rn
  from public.release_voting_rounds
)
update public.release_voting_rounds r
set slug = r.slug || '-' || left(r.id::text, 5)
from duplicates d
where r.id = d.id and d.rn > 1;

alter table public.release_voting_rounds alter column slug set not null;
alter table public.release_voting_rounds alter column title set not null;
alter table public.release_voting_rounds alter column status set default 'draft';
alter table public.release_voting_rounds alter column places_count set default 12;
alter table public.release_voting_rounds alter column is_current set default false;
alter table public.release_voting_rounds alter column is_public_results set default false;

create unique index if not exists release_voting_rounds_slug_unique_idx on public.release_voting_rounds(slug);
create index if not exists release_voting_rounds_current_idx on public.release_voting_rounds(is_current);
create index if not exists release_voting_rounds_public_results_idx on public.release_voting_rounds(is_public_results);
create index if not exists release_voting_songs_round_sort_idx on public.release_voting_songs(round_id, sort_order);
create index if not exists release_voting_votes_round_verified_idx on public.release_voting_votes(round_id, is_verified);

create unique index if not exists release_voting_vote_items_vote_song_unique_idx on public.release_voting_vote_items(vote_id, song_id);
create unique index if not exists release_voting_vote_items_vote_points_unique_idx on public.release_voting_vote_items(vote_id, points);

insert into public.app_settings(key, value)
values ('impressum_text', '')
on conflict (key) do nothing;

-- 6) RLS aktiv lassen. Die App nutzt serverseitig den Service-Role-Key.
alter table public.release_voting_rounds enable row level security;
alter table public.release_voting_songs enable row level security;
alter table public.release_voting_votes enable row level security;
alter table public.release_voting_vote_items enable row level security;
alter table public.app_settings enable row level security;

-- 7) Supabase Schema Cache neu laden
notify pgrst, 'reload schema';

-- 8) Kontrollausgabe: Diese Spalten sollten danach vorhanden sein. start_at/end_at sollten NICHT mehr auftauchen.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'release_voting_rounds'
order by ordinal_position;
