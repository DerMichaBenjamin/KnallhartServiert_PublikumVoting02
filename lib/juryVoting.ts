import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { JURY_PLACES_COUNT, type Round, type Song } from './releaseVotingShared';
import { databaseError } from './supabaseErrors';

export { JURY_PLACES_COUNT };

export type JuryProfile = {
  id: string;
  name: string;
  is_default: boolean;
};

export type JuryRoundJuror = {
  id: string;
  round_id: string;
  profile_id: string | null;
  display_name: string;
  access_token: string;
  voting_role: 'jury' | 'dj';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type JuryVote = {
  id: string;
  round_id: string;
  round_juror_id: string;
  submitted_at: string;
  updated_at: string;
};

export type JuryVoteItem = {
  vote_id: string;
  song_id: string;
  points: number;
};

export type AdminJuryJurorRow = JuryRoundJuror & {
  submitted_at: string | null;
  vote_updated_at: string | null;
  items: JuryVoteItem[];
};

export type AdminJuryRoundData = {
  defaultProfiles: JuryProfile[];
  jurors: AdminJuryJurorRow[];
};

export type JuryAccessData = {
  round: Round;
  juror: JuryRoundJuror;
  songs: Song[];
  items: JuryVoteItem[];
  submittedAt: string | null;
  updatedAt: string | null;
  isOpen: boolean;
  closeReason: string | null;
};

function effectiveJuryEnd(round: Round) {
  return round.jury_voting_ends_at || round.ends_at || null;
}

export function getJuryOpenState(round: Round) {
  const now = Date.now();
  if (round.jury_voting_closed) return { isOpen: false, closeReason: 'Das Jury-Voting wurde im Adminbereich geschlossen.' };
  if (round.status !== 'live') return { isOpen: false, closeReason: 'Diese Abstimmung ist aktuell nicht live.' };
  if (round.starts_at && Date.parse(round.starts_at) > now) return { isOpen: false, closeReason: 'Das Jury-Voting hat noch nicht begonnen.' };

  const juryEnd = effectiveJuryEnd(round);
  if (juryEnd && Date.parse(juryEnd) < now) return { isOpen: false, closeReason: 'Die Frist für das Jury-Voting ist abgelaufen.' };

  return { isOpen: true, closeReason: null };
}

export async function getAdminJuryRoundData(
  roundId: string,
  options: { role?: 'jury' | 'dj' } = {},
): Promise<AdminJuryRoundData> {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return { defaultProfiles: [], jurors: [] };

  const [profilesResult, jurorsResult] = await Promise.all([
    sb.from('release_voting_jury_profiles').select('id,name,is_default').eq('is_default', true).order('name'),
    sb.from('release_voting_round_jurors').select('*').eq('round_id', roundId).eq('voting_role', options.role || 'jury').order('created_at', { ascending: true }),
  ]);
  if (profilesResult.error) throw databaseError('Juryprofile konnten nicht geladen werden', profilesResult.error);
  if (jurorsResult.error) throw databaseError('Jury-Mitglieder konnten nicht geladen werden', jurorsResult.error);
  const profiles = profilesResult.data;
  const jurors = jurorsResult.data;

  const jurorRows = (jurors || []) as JuryRoundJuror[];
  const ids = jurorRows.map((juror) => juror.id);
  let votes: JuryVote[] = [];

  if (ids.length) {
    const { data, error } = await sb.from('release_voting_jury_votes').select('*').in('round_juror_id', ids);
    if (error) throw databaseError('Jury-Votings konnten nicht geladen werden', error);
    votes = (data || []) as JuryVote[];
  }

  const voteByJuror = new Map(votes.map((vote) => [vote.round_juror_id, vote]));
  const voteIds = votes.map((vote) => vote.id);
  let voteItems: JuryVoteItem[] = [];

  if (voteIds.length) {
    const { data, error } = await sb
      .from('release_voting_jury_vote_items')
      .select('vote_id,song_id,points')
      .in('vote_id', voteIds);
    if (error) throw databaseError('Jury-Einzelwertungen konnten nicht geladen werden', error);
    voteItems = (data || []) as JuryVoteItem[];
  }

  const itemsByVoteId = new Map<string, JuryVoteItem[]>();
  for (const item of voteItems) {
    const current = itemsByVoteId.get(item.vote_id) || [];
    current.push(item);
    itemsByVoteId.set(item.vote_id, current);
  }

  return {
    defaultProfiles: (profiles || []) as JuryProfile[],
    jurors: jurorRows.map((juror) => {
      const vote = voteByJuror.get(juror.id);
      return {
        ...juror,
        submitted_at: vote?.submitted_at || null,
        vote_updated_at: vote?.updated_at || null,
        items: vote?.id
          ? [...(itemsByVoteId.get(vote.id) || [])].sort((a, b) => Number(b.points) - Number(a.points))
          : [],
      };
    }),
  };
}

export async function getJuryAccessData(accessToken: string): Promise<JuryAccessData | null> {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return null;

  const token = String(accessToken || '').trim();
  if (!token) return null;

  const { data: jurorData, error: jurorError } = await sb
    .from('release_voting_round_jurors')
    .select('*')
    .eq('access_token', token)
    .eq('voting_role', 'jury')
    .eq('is_active', true)
    .maybeSingle();

  if (jurorError || !jurorData) return null;
  const juror = jurorData as JuryRoundJuror;

  const [{ data: roundData }, { data: songData }, { data: voteData }] = await Promise.all([
    sb.from('release_voting_rounds').select('*').eq('id', juror.round_id).maybeSingle(),
    sb.from('release_voting_songs').select('*').eq('round_id', juror.round_id).order('sort_order').order('created_at', { ascending: true }),
    sb.from('release_voting_jury_votes').select('*').eq('round_juror_id', juror.id).maybeSingle(),
  ]);

  if (!roundData) return null;
  const round = roundData as Round;
  const songs = (songData || []) as Song[];
  const vote = voteData as JuryVote | null;

  let items: JuryVoteItem[] = [];
  if (vote?.id) {
    const { data } = await sb
      .from('release_voting_jury_vote_items')
      .select('vote_id,song_id,points')
      .eq('vote_id', vote.id)
      .order('points', { ascending: false });
    items = (data || []) as JuryVoteItem[];
  }

  const openState = getJuryOpenState(round);

  return {
    round,
    juror,
    songs,
    items,
    submittedAt: vote?.submitted_at || null,
    updatedAt: vote?.updated_at || null,
    ...openState,
  };
}
