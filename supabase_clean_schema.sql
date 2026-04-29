create extension if not exists pgcrypto;

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
  points integer not null,
  unique(vote_id, song_id),
  unique(vote_id, points)
);

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

insert into public.app_settings(key,value) values('impressum_text','') on conflict(key) do nothing;

alter table public.release_voting_rounds enable row level security;
alter table public.release_voting_songs enable row level security;
alter table public.release_voting_votes enable row level security;
alter table public.release_voting_vote_items enable row level security;
alter table public.app_settings enable row level security;

notify pgrst, 'reload schema';
