import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { getRoundVoteCounts } from './releaseVoting';
import type { Round } from './releaseVotingShared';
import type { AdminRoundStatus } from './adminUi';
import { databaseError } from './supabaseErrors';
import { STATISTICS_TEST_PATTERN } from './statisticsRoundFilter';

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
  if (result.error) throw databaseError(`${label} konnten nicht gezählt werden`, result.error);
  return result.count || 0;
}

async function countByRoundIds(
  roundIds: string[],
  label: string,
  request: (ids: string[]) => PromiseLike<{ count: number | null; error: unknown }>,
) {
  let total = 0;
  for (let index = 0; index < roundIds.length; index += 75) {
    total += countValue(await request(roundIds.slice(index, index + 75)), label);
  }
  return total;
}

function safeSearch(value: string) {
  return value.trim().replace(/[%_(),]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
}

async function getAdminRoundOverview(round: Round): Promise<AdminRoundOverview> {
  const sb = getSupabaseAdminClient();
  if (!sb) return emptyAdminRoundOverview(round.id);

  const [voteCounts, songsResult, jurorsResult] = await Promise.all([
    getRoundVoteCounts(round.id),
    sb.from('release_voting_songs').select('id', { count: 'exact', head: true }).eq('round_id', round.id).eq('is_active', true),
    sb.from('release_voting_round_jurors').select('id').eq('round_id', round.id).eq('voting_role', 'jury').or('is_active.eq.true,is_active.is.null'),
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
  excludeTestRounds = false,
}: {
  page?: number;
  pageSize?: number;
  query?: string;
  filter?: AdminRoundsFilter;
  excludeTestRounds?: boolean;
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
  if (excludeTestRounds) request = request.not('title', 'ilike', STATISTICS_TEST_PATTERN).not('slug', 'ilike', STATISTICS_TEST_PATTERN);
  const normalizedQuery = safeSearch(query);
  if (normalizedQuery) request = request.or(`title.ilike.%${normalizedQuery}%,slug.ilike.%${normalizedQuery}%`);

  const from = (safePage - 1) * safePageSize;
  const { data, count, error } = await request.range(from, from + safePageSize - 1);
  if (error) throw error;
  const rounds = (data || []) as Round[];
  const overviews = await getAdminRoundOverviews(rounds);
  return { rounds, overviews, total: count || 0, page: safePage, pageSize: safePageSize };
}

export async function getAdminOverviewTotals(
  roundsInput?: Round[],
  options: { excludeTestRounds?: boolean } = {},
): Promise<AdminOverviewTotals> {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) return { databaseRounds: 0, conductedRounds: 0, songsCount: 0, totalVotes: 0, confirmedVotes: 0, countedVotes: 0, reviewVotes: 0, excludedVotes: 0, unverifiedVotes: 0 };

  let statisticsRoundIds: string[] | null = null;
  if (options.excludeTestRounds) {
    statisticsRoundIds = [];
    for (let from = 0; ; from += OVERVIEW_ROUND_PAGE_SIZE) {
      const { data, error } = await sb
        .from('release_voting_rounds')
        .select('id')
        .not('title', 'ilike', STATISTICS_TEST_PATTERN)
        .not('slug', 'ilike', STATISTICS_TEST_PATTERN)
        .order('created_at', { ascending: false })
        .range(from, from + OVERVIEW_ROUND_PAGE_SIZE - 1);
      if (error) throw databaseError('Statistik-Umfragen konnten nicht geladen werden', error);
      const ids = (data || []).map((round) => String(round.id));
      statisticsRoundIds.push(...ids);
      if (ids.length < OVERVIEW_ROUND_PAGE_SIZE) break;
    }
  }

  const scopedCount = (
    label: string,
    requestAll: () => PromiseLike<{ count: number | null; error: unknown }>,
    requestIds: (ids: string[]) => PromiseLike<{ count: number | null; error: unknown }>,
  ) => statisticsRoundIds
    ? countByRoundIds(statisticsRoundIds, label, requestIds)
    : Promise.resolve(requestAll()).then((result) => countValue(result, label));

  const [databaseRounds, songsCount, totalVotes, confirmedVotes, countedVotes, reviewVotes, excludedVotes] = await Promise.all([
    statisticsRoundIds
      ? Promise.resolve(statisticsRoundIds.length)
      : Promise.resolve(sb.from('release_voting_rounds').select('id', { count: 'exact', head: true })).then((result) => countValue(result, 'Umfragen')),
    scopedCount(
      'Songs',
      () => sb.from('release_voting_songs').select('id', { count: 'exact', head: true }).eq('is_active', true),
      (ids) => sb.from('release_voting_songs').select('id', { count: 'exact', head: true }).in('round_id', ids).eq('is_active', true),
    ),
    scopedCount(
      'Publikumsstimmen',
      () => sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('voting_channel', 'audience'),
      (ids) => sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).in('round_id', ids).eq('voting_channel', 'audience'),
    ),
    scopedCount(
      'Bestätigte Stimmen',
      () => sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('voting_channel', 'audience').eq('is_verified', true),
      (ids) => sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).in('round_id', ids).eq('voting_channel', 'audience').eq('is_verified', true),
    ),
    scopedCount(
      'Gewertete Stimmen',
      () => sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('voting_channel', 'audience').eq('is_verified', true).or('is_counted.eq.true,is_counted.is.null'),
      (ids) => sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).in('round_id', ids).eq('voting_channel', 'audience').eq('is_verified', true).or('is_counted.eq.true,is_counted.is.null'),
    ),
    scopedCount(
      'Stimmen in Prüfung',
      () => sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('voting_channel', 'audience').eq('is_verified', true).eq('is_counted', false).or('integrity_status.neq.excluded,integrity_status.is.null'),
      (ids) => sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).in('round_id', ids).eq('voting_channel', 'audience').eq('is_verified', true).eq('is_counted', false).or('integrity_status.neq.excluded,integrity_status.is.null'),
    ),
    scopedCount(
      'Ausgeschlossene Stimmen',
      () => sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('voting_channel', 'audience').eq('is_verified', true).eq('integrity_status', 'excluded'),
      (ids) => sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).in('round_id', ids).eq('voting_channel', 'audience').eq('is_verified', true).eq('integrity_status', 'excluded'),
    ),
  ]);

  let roundIds = roundsInput?.map((round) => round.id) || [];
  if (!roundsInput) {
    if (statisticsRoundIds) roundIds = [...statisticsRoundIds];
    else {
      for (let from = 0; ; from += OVERVIEW_ROUND_PAGE_SIZE) {
        const { data, error } = await sb
          .from('release_voting_rounds')
          .select('id')
          .order('created_at', { ascending: false })
          .range(from, from + OVERVIEW_ROUND_PAGE_SIZE - 1);
        if (error) throw databaseError('Umfragen konnten nicht geladen werden', error);
        const pageIds = (data || []).map((round) => String(round.id));
        roundIds.push(...pageIds);
        if (pageIds.length < OVERVIEW_ROUND_PAGE_SIZE) break;
      }
    }
  }

  const activityCounts = await Promise.all(
    roundIds.map(async (roundId) => {
      const [audience, juryJurors] = await Promise.all([
        sb.from('release_voting_votes').select('id', { count: 'exact', head: true }).eq('round_id', roundId).eq('voting_channel', 'audience'),
        sb.from('release_voting_round_jurors').select('id').eq('round_id', roundId).eq('voting_role', 'jury'),
      ]);
      if (juryJurors.error) throw databaseError('Juryaktivität konnte nicht geladen werden', juryJurors.error);
      const juryIds = (juryJurors.data || []).map((juror) => String(juror.id));
      const jury = juryIds.length
        ? await sb.from('release_voting_jury_votes').select('id', { count: 'exact', head: true }).eq('round_id', roundId).in('round_juror_id', juryIds).not('submitted_at', 'is', null)
        : { count: 0, error: null };
      return countValue(audience, 'Publikumsaktivität') > 0 || countValue(jury, 'Juryaktivität') > 0;
    })
  );
  const conductedRounds = activityCounts.filter(Boolean).length;
  return {
    databaseRounds,
    conductedRounds,
    songsCount,
    totalVotes,
    confirmedVotes,
    countedVotes,
    reviewVotes,
    excludedVotes,
    unverifiedVotes: Math.max(0, totalVotes - confirmedVotes),
  };
}

export function emptyAdminRoundOverview(roundId: string): AdminRoundOverview {
  return { roundId, songsCount: 0, jurorsCount: 0, jurySubmitted: 0, totalVotes: 0, confirmedVotes: 0, countedVotes: 0, reviewVotes: 0, excludedVotes: 0, unverifiedVotes: 0 };
}
