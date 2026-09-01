-- Knallhart serviert – Jury-Voting Stufe 1
-- In Supabase ausführen: SQL Editor -> New Query -> Run
-- Danach die aktualisierte App deployen.

create extension if not exists pgcrypto;

-- Separate Jury-Einstellungen pro Release-Check.
alter table public.release_voting_rounds
  add column if not exists jury_voting_closed boolean not null default false;

alter table public.release_voting_rounds
  add column if not exists jury_voting_ends_at timestamptz;

-- Wiederkehrende Juroren. Gäste müssen nicht als Profil gespeichert werden.
create table if not exists public.release_voting_jury_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists release_voting_jury_profiles_name_unique_idx
  on public.release_voting_jury_profiles (lower(name));

-- Juroren-Zuordnung zu genau einer Voting-Runde inklusive persönlichem Zugangslink.
create table if not exists public.release_voting_round_jurors (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.release_voting_rounds(id) on delete cascade,
  profile_id uuid references public.release_voting_jury_profiles(id) on delete set null,
  display_name text not null,
  access_token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists release_voting_round_jurors_round_name_unique_idx
  on public.release_voting_round_jurors (round_id, lower(display_name));

create index if not exists release_voting_round_jurors_round_idx
  on public.release_voting_round_jurors (round_id, created_at);

-- Pro Juror/Runde existiert genau eine bearbeitbare Jury-Stimme.
create table if not exists public.release_voting_jury_votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.release_voting_rounds(id) on delete cascade,
  round_juror_id uuid not null references public.release_voting_round_jurors(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(round_juror_id)
);

create index if not exists release_voting_jury_votes_round_idx
  on public.release_voting_jury_votes (round_id, submitted_at);

create table if not exists public.release_voting_jury_vote_items (
  id uuid primary key default gen_random_uuid(),
  vote_id uuid not null references public.release_voting_jury_votes(id) on delete cascade,
  song_id uuid not null references public.release_voting_songs(id) on delete cascade,
  points integer not null check (points between 1 and 12),
  created_at timestamptz not null default now(),
  unique(vote_id, song_id),
  unique(vote_id, points)
);

-- Standardjuroren für neue/aktuelle Runden. Können im Backend pro Runde ergänzt werden.
insert into public.release_voting_jury_profiles(name, is_default)
select seed.name, true
from (values ('Banjee'), ('DJ Marcus Aurelius'), ('Micha Benjamin')) as seed(name)
where not exists (
  select 1 from public.release_voting_jury_profiles p where lower(p.name) = lower(seed.name)
);

update public.release_voting_jury_profiles
set is_default = true, updated_at = now()
where lower(name) in ('banjee', 'dj marcus aurelius', 'micha benjamin');

-- Die App greift ausschließlich serverseitig mit dem Service-Role-Key zu.
alter table public.release_voting_jury_profiles enable row level security;
alter table public.release_voting_round_jurors enable row level security;
alter table public.release_voting_jury_votes enable row level security;
alter table public.release_voting_jury_vote_items enable row level security;

notify pgrst, 'reload schema';
