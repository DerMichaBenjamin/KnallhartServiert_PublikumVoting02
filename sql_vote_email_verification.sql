alter table public.release_voting_votes
add column if not exists is_verified boolean not null default false,
add column if not exists verified_at timestamp without time zone,
add column if not exists verify_token_hash text,
add column if not exists verify_expires_at timestamp without time zone,
add column if not exists verification_sent_at timestamp without time zone;

create index if not exists release_voting_votes_round_id_is_verified_idx
on public.release_voting_votes (round_id, is_verified);

NOTIFY pgrst, 'reload schema';
