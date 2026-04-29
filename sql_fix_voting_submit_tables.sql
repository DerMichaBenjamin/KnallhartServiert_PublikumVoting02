-- KHS Voting: Fix für Absenden der Stimmen
-- Ausführen in Supabase: SQL Editor -> New Query -> Run

create extension if not exists pgcrypto;

-- Stimmen-Tabelle sicherstellen
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

alter table public.release_voting_votes add column if not exists round_id uuid references public.release_voting_rounds(id) on delete cascade;
alter table public.release_voting_votes add column if not exists juror_name text;
alter table public.release_voting_votes add column if not exists juror_email text;
alter table public.release_voting_votes add column if not exists juror_instagram text;
alter table public.release_voting_votes add column if not exists is_verified boolean not null default false;
alter table public.release_voting_votes add column if not exists verified_at timestamptz;
alter table public.release_voting_votes add column if not exists verify_token_hash text;
alter table public.release_voting_votes add column if not exists verify_sent_at timestamptz;
alter table public.release_voting_votes add column if not exists verify_expires_at timestamptz;
alter table public.release_voting_votes add column if not exists zonk_song_id uuid references public.release_voting_songs(id) on delete set null;
alter table public.release_voting_votes add column if not exists created_at timestamptz not null default now();

-- Vote-Items-Tabelle sicherstellen
create table if not exists public.release_voting_vote_items (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.release_voting_votes(id) on delete cascade,
  song_id uuid not null references public.release_voting_songs(id) on delete cascade,
  points integer not null
);

alter table public.release_voting_vote_items add column if not exists vote_id uuid references public.release_voting_votes(id) on delete cascade;
alter table public.release_voting_vote_items add column if not exists song_id uuid references public.release_voting_songs(id) on delete cascade;
alter table public.release_voting_vote_items add column if not exists points integer;

-- Indizes für Auswertung und Dubletten pro Voting
create index if not exists release_voting_votes_round_verified_idx
on public.release_voting_votes(round_id, is_verified);

create index if not exists release_voting_votes_token_idx
on public.release_voting_votes(verify_token_hash);

create unique index if not exists release_voting_vote_items_vote_song_unique_idx
on public.release_voting_vote_items(vote_id, song_id);

create unique index if not exists release_voting_vote_items_vote_points_unique_idx
on public.release_voting_vote_items(vote_id, points);

alter table public.release_voting_votes enable row level security;
alter table public.release_voting_vote_items enable row level security;

notify pgrst, 'reload schema';

-- Kontrolle: Diese Tabellen müssen vorhanden sein
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'release_voting_rounds',
    'release_voting_songs',
    'release_voting_votes',
    'release_voting_vote_items',
    'app_settings'
  )
order by table_name;
