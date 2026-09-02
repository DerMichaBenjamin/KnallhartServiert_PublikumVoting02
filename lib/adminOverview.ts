import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { getRoundVoteCounts } from './releaseVoting';
import type { Round } from './releaseVotingShared';
import type { AdminRoundStatus } from './adminUi';

export type AdminRoundOverview = {
  roundId: string;
  songsCount: number;
  jurorsCount: number;
  jurySubmitted: number;
  totalVotes: number;
  confirmedVotes: number;
  countedVotes: number;
  reviewVotes: number;
  excludedVotes: number;
  unverifiedVotes: number;
};

export type AdminOverviewTotals = {
  databaseRounds: number;
  conductedRounds: number;
  songsCount: number;
  totalVotes: number;
  confirmedVotes: number;
  countedVotes: number;
  reviewVotes: number;
  excludedVotes: number;
  unverifiedVotes: number;
};

export type AdminRoundsFilter = 'all' | AdminRoundStatus;

export type AdminRoundsPageData = {
  rounds: Round[];
  overviews: AdminRoundOverview[];
  total: number;
  page: number;
  pageSize: number;
};

const OVERVIEW_ROUND_PAGE_SIZE = 1000;

const ROUND_STATUS: Record<Exclude<AdminRoundsFilter, 'all'>, string> = {
  active: 'live',
  planned: 'draft',
  ended: 'ended',
};

function countValue(result: { count: number | null; error: unknown }, label: string) {
  if (result.error) throw new Error(`${label} konnten nicht gezählt werden.`);
  return result.count || 0;
}

function safeSearch(value: string) {
  return value.trim().replace(/[%_(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
}

async function getAdminRoundOverview(round: Round): Promise<AdminRoundOverview> {
  const sb = getSupabaseAdminClient();
  if (!sb) return emptyAdminRoundOverview(round.id);

  const [voteCounts, songsResult, jurorsResult] = await Promise.all([
    getRoundVoteCounts(round.id),
    sb.from('release_voting_songs').select('id', { count: 'exact', head: true }).eq('round_id', round.id),
    sb.from('release_voting_round_jurors').select('id').eq('round_id', round.id).or('is_active.eq.true,is_active.is.null'),
  ]);

  if (jurorsResult.error) throw jurorsResult.error;
  const activeJurorIds = (jurorsResult.data || []).map((juror) => String(juror.id));
  const jurySubmittedResult = activeJurorIds.length
    ? await sb
      .from('release_voting_jury_votes')
      .select('round_juror_id', { count: 'exact', head: true })
      .eq('round_id', round.id)
      .not('submitted_at', 'is', null)
      .in('round_juror_id', activeJurorIds)
    : { count: 0, error: null };

  return {
    roundId: round.id,
    songsCount: countValue(songsResult, 'Songs'),
    jurorsCount: activeJurorIds.length,
    jurySubmitted: countValue(jurySubmittedResult, 'Abgegebene Jury-Wertungen'),
    ...voteCounts,
  };
}

export async function getAdminRoundOverviews(rounds: Round[]): Promise<AdminRoundOverview[]> {
  noStore();
  if (!rounds.length) return [];
  return Promise.all(rounds.map(getAdminRoundOverview));
}

export async function getAdminRoundsPage({
  page = 1,
  pageSize = 8,
  query = '',
  filter = 'all',
}: {
  page?: number;
  pageSize?: number;
  query?: string;
  filter?: AdminRoundsFilter;
}): Promise<AdminRoundsPageData> {
  noStore();
  const sb = getSupabaseAdminClient();
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(50, Math.max(1, Math.floor(pageSize)));
  if (!sb) return { rounds: [], overviews: [], total: 0, page: safePage, pageSize: safePageSize };

  let request = sb
    .from('release_voting_rounds')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filter !== 'all') request = request.eq('status', ROUND_STATUS[filter]);
  const normalizedQuery = safeSearch(query);
  if (normalizedQuery) request = request.or(`title.ilike.%${normalizedQuery}%,slug.ilike.%${normalizedQuery}%`);

  const from = (safePage - 1) * safePageSize;
  const { data, count, error } = await request.range(from, from + safePageSize - 1);
  if (error) throw error;
  const rounds = (data || []) as Round[];
  const overviews = await getAdminRoundOverviews(rounds);
  return { rounds, overviews, total: count || 0, page: safePage, pageSize: safePageSize };
}

export async function getAdminOverviewTotals(roundsInput?: Round[]): Promise<AdminOverviewTotals> {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return { databaseRounds: 0, conductedRounds: 0, songsCount: 0, totalVotes: 0, confirmedVotes: 0, countedVotes: 0, reviewVotes: 0, excludedVotes: 0, unverifiedVotes: 0 };

  const [roundsCount, songs, total, confirmed, counted, review, excluded] = await Promise.all([
    sb.from('release_voting_rounds').select('id', { count: 'exact', head: true }),
    sb.from('release_voting_songs').select('id', { count: 'exact', head: true }),
    sb.from('release_voting_votes').select('id', { count: 'exact', head: true }),
    sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('is_verified', true),
    sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('is_verified', true).or('is_counted.eq.true,is_counted.is.null'),
    sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('is_verified', true).eq('is_counted', false).or('integrity_status.neq.excluded,integrity_status.is.null'),
    sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('is_verified', true).eq('integrity_status', 'excluded'),
  ]);

  let roundIds = roundsInput?.map((round) => round.id) || [];
  if (!roundsInput) {
    for (let from = 0; ; from += OVERVIEW_ROUND_PAGE_SIZE) {
      const { data, error } = await sb
        .from('release_voting_rounds')
        .select('id')
        .order('created_at', { ascending: false })
        .range(from, from + OVERVIEW_ROUND_PAGE_SIZE - 1);
      if (error) throw error;
      const pageIds = (data || []).map((round) => String(round.id));
      roundIds.push(...pageIds);
      if (pageIds.length < OVERVIEW_ROUND_PAGE_SIZE) break;
    }
  }

  const activityCounts = await Promise.all(
    roundIds.map(async (roundId) => {
      const [audience, jury] = await Promise.all([
        sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('round_id', roundId),
        sb.from('release_voting_jury_votes').select('id', { count: 'exact', head: true }).eq('round_id', roundId).not('submitted_at', 'is', null),
      ]);
      return countValue(audience, 'Publikumsaktivität') > 0 || countValue(jury, 'Juryaktivität') > 0;
    })
  );
  const conductedRounds = activityCounts.filter(Boolean).length;
  const totalVotes = countValue(total, 'Publikumsstimmen');
  const confirmedVotes = countValue(confirmed, 'Bestätigte Stimmen');

  return {
    databaseRounds: countValue(roundsCount, 'Umfragen'),
    conductedRounds,
    songsCount: countValue(songs, 'Songs'),
    totalVotes,
    confirmedVotes,
    countedVotes: countValue(counted, 'Gewertete Stimmen'),
    reviewVotes: countValue(review, 'Stimmen in Prüfung'),
    excludedVotes: countValue(excluded, 'Ausgeschlossene Stimmen'),
    unverifiedVotes: Math.max(0, totalVotes - confirmedVotes),
  };
}

export function emptyAdminRoundOverview(roundId: string): AdminRoundOverview {
  return { roundId, songsCount: 0, jurorsCount: 0, jurySubmitted: 0, totalVotes: 0, confirmedVotes: 0, countedVotes: 0, reviewVotes: 0, excludedVotes: 0, unverifiedVotes: 0 };
}
