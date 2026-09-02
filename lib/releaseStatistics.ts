import 'server-only';

import { unstable_noStore as noStore } from 'next/cache';
import { getSupabaseAdminClient } from './supabaseAdmin';
import { buildLeaderboard, buildZonk, type AdminRoundSummary, type Round, type Song, type VoteItem } from './releaseVotingShared';
import type { AdminJuryRoundData, JuryRoundJuror, JuryVoteItem } from './juryVoting';
import {
  buildArtistHistories,
  buildReleaseWeekStatistics,
  sortWeeksNewestFirst,
  type ArtistHistory,
  type ReleaseWeekStatistics,
} from './releaseStatisticsCore';

const PAGE_SIZE = 1000;
const ID_CHUNK_SIZE = 75;

type StatisticsVoteRow = {
  id: string;
  round_id: string;
  is_verified: boolean;
  is_counted: boolean | null;
  integrity_status: 'clear' | 'review' | 'approved' | 'excluded' | null;
  zonk_song_id: string | null;
};

type StatisticsJuryVoteRow = {
  id: string;
  round_id: string;
  round_juror_id: string;
  submitted_at: string | null;
  updated_at: string | null;
};

type PageResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

export type StatisticsArchiveTotals = {
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

export type ReleaseStatisticsArchive = {
  weeks: ReleaseWeekStatistics[];
  artists: ArtistHistory[];
  totals: StatisticsArchiveTotals;
};

async function fetchAllPages<T>(label: string, loadPage: (from: number, to: number) => Promise<PageResult<T>>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await loadPage(from, from + PAGE_SIZE - 1);
    if (result.error) throw new Error(`${label} konnten nicht geladen werden: ${result.error.message || 'Unbekannter Datenbankfehler'}`);
    const page = result.data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function chunks<T>(rows: T[], size = ID_CHUNK_SIZE) {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}

async function fetchPublicItems(voteIds: string[]) {
  const sb = getSupabaseAdminClient();
  if (!sb || !voteIds.length) return [] as VoteItem[];
  const rows: VoteItem[] = [];
  const batches = chunks(voteIds);
  for (let index = 0; index < batches.length; index += 10) {
    const results = await Promise.all(batches.slice(index, index + 10).map(async (ids) => {
      const { data, error } = await sb.from('release_voting_vote_items').select('vote_id,song_id,points').in('vote_id', ids);
      return { data: (data || []) as VoteItem[], error };
    }));
    for (const result of results) {
      if (result.error) throw new Error(`Publikumswertungen konnten nicht geladen werden: ${result.error.message}`);
      rows.push(...result.data);
    }
  }
  return rows;
}

async function fetchJuryItems(voteIds: string[]) {
  const sb = getSupabaseAdminClient();
  if (!sb || !voteIds.length) return [] as JuryVoteItem[];
  const rows: JuryVoteItem[] = [];
  const batches = chunks(voteIds);
  for (let index = 0; index < batches.length; index += 10) {
    const results = await Promise.all(batches.slice(index, index + 10).map(async (ids) => {
      const { data, error } = await sb.from('release_voting_jury_vote_items').select('vote_id,song_id,points').in('vote_id', ids);
      return { data: (data || []) as JuryVoteItem[], error };
    }));
    for (const result of results) {
      if (result.error) throw new Error(`Jurywertungen konnten nicht geladen werden: ${result.error.message}`);
      rows.push(...result.data);
    }
  }
  return rows;
}

function pushByKey<T>(map: Map<string, T[]>, key: string, row: T) {
  const current = map.get(key) || [];
  current.push(row);
  map.set(key, current);
}

export async function getReleaseStatisticsArchive(): Promise<ReleaseStatisticsArchive> {
  noStore();
  const sb = getSupabaseAdminClient();
  if (!sb) {
    return {
      weeks: [], artists: [],
      totals: { databaseRounds: 0, conductedRounds: 0, songsCount: 0, totalVotes: 0, confirmedVotes: 0, countedVotes: 0, reviewVotes: 0, excludedVotes: 0, unverifiedVotes: 0 },
    };
  }

  const [rounds, songs, votes, jurors, juryVotes] = await Promise.all([
    fetchAllPages<Round>('Umfragen', async (from, to) => {
      const { data, error } = await sb.from('release_voting_rounds').select('*').order('created_at', { ascending: false }).range(from, to);
      return { data: (data || []) as Round[], error };
    }),
    fetchAllPages<Song>('Songs', async (from, to) => {
      const { data, error } = await sb.from('release_voting_songs').select('id,round_id,title,artist,sort_order').order('created_at', { ascending: true }).range(from, to);
      return { data: (data || []) as Song[], error };
    }),
    fetchAllPages<StatisticsVoteRow>('Publikumsstimmen', async (from, to) => {
      const { data, error } = await sb.from('release_voting_votes').select('id,round_id,is_verified,is_counted,integrity_status,zonk_song_id').order('created_at', { ascending: true }).range(from, to);
      return { data: (data || []) as StatisticsVoteRow[], error };
    }),
    fetchAllPages<JuryRoundJuror>('Jury-Mitglieder', async (from, to) => {
      const { data, error } = await sb.from('release_voting_round_jurors').select('*').order('created_at', { ascending: true }).range(from, to);
      return { data: (data || []) as JuryRoundJuror[], error };
    }),
    fetchAllPages<StatisticsJuryVoteRow>('Jury-Votings', async (from, to) => {
      const { data, error } = await sb.from('release_voting_jury_votes').select('id,round_id,round_juror_id,submitted_at,updated_at').order('updated_at', { ascending: true }).range(from, to);
      return { data: (data || []) as StatisticsJuryVoteRow[], error };
    }),
  ]);

  // Die Ergebnislogik wertet wie bisher ausschließlich ausdrücklich gewertete Votes aus.
  const resultVotes = votes.filter((vote) => vote.is_verified && vote.is_counted === true);
  const [publicItems, juryItems] = await Promise.all([
    fetchPublicItems(resultVotes.map((vote) => vote.id)),
    fetchJuryItems(juryVotes.map((vote) => vote.id)),
  ]);

  const songsByRound = new Map<string, Song[]>();
  const votesByRound = new Map<string, StatisticsVoteRow[]>();
  const publicItemsByVote = new Map<string, VoteItem[]>();
  const jurorsByRound = new Map<string, JuryRoundJuror[]>();
  const juryVotesByJuror = new Map<string, StatisticsJuryVoteRow>();
  const juryItemsByVote = new Map<string, JuryVoteItem[]>();
  for (const song of songs) pushByKey(songsByRound, song.round_id, song);
  for (const vote of votes) pushByKey(votesByRound, vote.round_id, vote);
  for (const item of publicItems) pushByKey(publicItemsByVote, item.vote_id, item);
  for (const juror of jurors) pushByKey(jurorsByRound, juror.round_id, juror);
  for (const vote of juryVotes) juryVotesByJuror.set(vote.round_juror_id, vote);
  for (const item of juryItems) pushByKey(juryItemsByVote, item.vote_id, item);

  const weeks = sortWeeksNewestFirst(rounds.map((round) => {
    const roundSongs = songsByRound.get(round.id) || [];
    const roundVotes = votesByRound.get(round.id) || [];
    const countedRows = roundVotes.filter((vote) => vote.is_verified && vote.is_counted === true);
    const roundItems = countedRows.flatMap((vote) => publicItemsByVote.get(vote.id) || []);
    const confirmedVotes = roundVotes.filter((vote) => vote.is_verified).length;
    const countedVotes = roundVotes.filter((vote) => vote.is_verified && vote.is_counted !== false).length;
    const excludedVotes = roundVotes.filter((vote) => vote.is_verified && vote.integrity_status === 'excluded').length;
    const reviewVotes = roundVotes.filter((vote) => vote.is_verified && vote.is_counted === false && vote.integrity_status !== 'excluded').length;
    const leaderboard = buildLeaderboard(roundSongs, countedRows, roundItems);
    const zonk = buildZonk(roundSongs, countedRows);
    const summary: AdminRoundSummary = {
      roundId: round.id,
      totalVotes: roundVotes.length,
      confirmedVotes,
      countedVotes,
      reviewVotes,
      excludedVotes,
      unverifiedVotes: Math.max(0, roundVotes.length - confirmedVotes),
      verifiedVotes: countedVotes,
      pendingVotes: Math.max(0, roundVotes.length - confirmedVotes),
      songsCount: roundSongs.length,
      leaderboard,
      zonk,
      participants: [],
    };
    const juryData: AdminJuryRoundData = {
      defaultProfiles: [],
      jurors: (jurorsByRound.get(round.id) || []).map((juror) => {
        const vote = juryVotesByJuror.get(juror.id);
        return {
          ...juror,
          submitted_at: vote?.submitted_at || null,
          vote_updated_at: vote?.updated_at || null,
          items: vote ? (juryItemsByVote.get(vote.id) || []).sort((a, b) => Number(b.points) - Number(a.points)) : [],
        };
      }),
    };
    return buildReleaseWeekStatistics(round, roundSongs, summary, juryData);
  }));

  const confirmedVotes = votes.filter((vote) => vote.is_verified).length;
  const countedVotes = votes.filter((vote) => vote.is_verified && vote.is_counted !== false).length;
  const excludedVotes = votes.filter((vote) => vote.is_verified && vote.integrity_status === 'excluded').length;
  const reviewVotes = votes.filter((vote) => vote.is_verified && vote.is_counted === false && vote.integrity_status !== 'excluded').length;
  const conducted = weeks.filter((week) => week.hasActivity);
  return {
    weeks,
    artists: buildArtistHistories(conducted),
    totals: {
      databaseRounds: rounds.length,
      conductedRounds: conducted.length,
      songsCount: songs.length,
      totalVotes: votes.length,
      confirmedVotes,
      countedVotes,
      reviewVotes,
      excludedVotes,
      unverifiedVotes: Math.max(0, votes.length - confirmedVotes),
    },
  };
}
