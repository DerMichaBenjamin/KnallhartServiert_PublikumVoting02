-- Diese Migration ist in der Produktions-Supabase-Datenbank bereits ausgeführt.
-- Die Datei dient dazu, Datenbank und Repository synchron zu dokumentieren.
-- Sie ist idempotent und kann bei Bedarf erneut ausgeführt werden.

alter table public.release_voting_votes
  add column if not exists display_order jsonb not null default '[]'::jsonb,
  add column if not exists selection_order jsonb not null default '[]'::jsonb,
  add column if not exists search_used boolean not null default false,
  add column if not exists move_count integer not null default 0,
  add column if not exists remove_count integer not null default 0,
  add column if not exists voting_duration_ms integer,
  add column if not exists behavior_score integer not null default 0,
  add column if not exists behavior_flags jsonb not null default '[]'::jsonb;

alter table public.release_voting_votes
  drop constraint if exists release_voting_votes_move_count_nonnegative,
  add constraint release_voting_votes_move_count_nonnegative check (move_count >= 0),
  drop constraint if exists release_voting_votes_remove_count_nonnegative,
  add constraint release_voting_votes_remove_count_nonnegative check (remove_count >= 0),
  drop constraint if exists release_voting_votes_voting_duration_ms_valid,
  add constraint release_voting_votes_voting_duration_ms_valid
    check (voting_duration_ms is null or (voting_duration_ms >= 0 and voting_duration_ms <= 86400000)),
  drop constraint if exists release_voting_votes_behavior_score_valid,
  add constraint release_voting_votes_behavior_score_valid check (behavior_score >= 0 and behavior_score <= 100);
