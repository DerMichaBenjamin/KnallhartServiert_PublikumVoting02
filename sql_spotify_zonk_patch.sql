-- Zusatzfelder für Spotify-Playlist und Z-O-N-K-Auswertung
alter table public.release_voting_rounds
add column if not exists spotify_playlist_id text;

alter table public.release_voting_votes
add column if not exists zonk_song text;

create index if not exists release_voting_votes_round_id_zonk_song_idx
on public.release_voting_votes (round_id, zonk_song);

NOTIFY pgrst, 'reload schema';
