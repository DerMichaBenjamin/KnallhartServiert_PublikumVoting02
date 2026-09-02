import 'server-only';

import { getSupabaseAdminClient } from './supabaseAdmin';
import { isVotingIpTrackingConfigured } from './ipHash';

import type {
  VotingSecurityAlert,
  VotingSecurityLevel,
  VotingSecurityParticipant,
  VotingSecurityReport,
} from './votingSecurityShared';

export type {
  VotingSecurityAlert,
  VotingSecurityKind,
  VotingSecurityLevel,
  VotingSecurityParticipant,
  VotingSecurityReport,
} from './votingSecurityShared';

type SecurityVote = {
  id: string;
  juror_name: string | null;
  juror_email: string | null;
  is_verified: boolean;
  is_excluded: boolean | null;
  created_at: string;
  verified_at: string | null;
  ip_hash: string | null;
};

type SecurityVoteItem = {
  vote_id: string;
  song_id: string;
  points: number;
};

type SecuritySong = {
  id: string;
  title: string;
  artist: string | null;
};

type SongSignal = {
  songId: string | null;
  songLabel: string | null;
  selectionPct: number;
  averagePoints: number;
  baselineAveragePoints: number;
  pointsLift: number;
};

const COMMON_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'gmx.de',
  'gmx.net',
  'gmx.com',
  'gmx.at',
  'gmx.ch',
  'web.de',
  'outlook.com',
  'outlook.de',
  'hotmail.com',
  'hotmail.de',
  'live.com',
  'live.de',
  'msn.com',
  'yahoo.com',
  'yahoo.de',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  't-online.de',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'freenet.de',
  'mail.de',
  'mail.com',
  'posteo.de',
  'vodafone.de',
  'arcor.de',
  '1und1.de',
  'online.de',
]);

function errorMessage(error: unknown) {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    const value = error as Record<string, unknown>;
    return [value.message, value.details, value.hint, value.code]
      .filter(Boolean)
      .map(String)
      .join(' | ');
  }
  return String(error);
}

function isMissingIpHashColumn(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return message.includes('ip_hash') && (
    message.includes('column') ||
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find')
  );
}

function emailDomain(email?: string | null) {
  const normalized = String(email || '').trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at < 0 || at === normalized.length - 1) return '';
  return normalized.slice(at + 1);
}

function songLabel(song?: SecuritySong | null) {
  if (!song) return null;
  return song.artist ? `${song.title} — ${song.artist}` : song.title;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function participant(vote: SecurityVote): VotingSecurityParticipant {
  return {
    voteId: vote.id,
    name: String(vote.juror_name || ''),
    email: String(vote.juror_email || ''),
    createdAt: vote.created_at,
    verifiedAt: vote.verified_at,
    isExcluded: Boolean(vote.is_excluded),
  };
}

function levelWeight(level: VotingSecurityLevel) {
  if (level === 'high') return 3;
  if (level === 'warning') return 2;
  return 1;
}

function groupSignal(
  groupVotes: SecurityVote[],
  allVerifiedVotes: SecurityVote[],
  itemsByVote: Map<string, Map<string, number>>,
  songs: SecuritySong[]
): SongSignal {
  const groupIds = new Set(groupVotes.map((vote) => vote.id));
  const baselineVotes = allVerifiedVotes.filter(
    (vote) => !vote.is_excluded && !groupIds.has(vote.id)
  );

  let best: SongSignal = {
    songId: null,
    songLabel: null,
    selectionPct: 0,
    averagePoints: 0,
    baselineAveragePoints: 0,
    pointsLift: 0,
  };

  for (const song of songs) {
    let groupPoints = 0;
    let groupSelections = 0;

    for (const vote of groupVotes) {
      const points = Number(itemsByVote.get(vote.id)?.get(song.id) || 0);
      groupPoints += points;
      if (points > 0) groupSelections += 1;
    }

    let baselinePoints = 0;
    for (const vote of baselineVotes) {
      baselinePoints += Number(itemsByVote.get(vote.id)?.get(song.id) || 0);
    }

    const averagePoints = groupVotes.length ? groupPoints / groupVotes.length : 0;
    const baselineAveragePoints = baselineVotes.length ? baselinePoints / baselineVotes.length : 0;
    const selectionPct = groupVotes.length ? (100 * groupSelections) / groupVotes.length : 0;
    const pointsLift = averagePoints - baselineAveragePoints;

    const currentScore = pointsLift * Math.sqrt(Math.max(1, groupVotes.length));
    const bestScore = best.pointsLift * Math.sqrt(Math.max(1, groupVotes.length));

    if (
      currentScore > bestScore ||
      (currentScore === bestScore && averagePoints > best.averagePoints)
    ) {
      best = {
        songId: song.id,
        songLabel: songLabel(song),
        selectionPct,
        averagePoints,
        baselineAveragePoints,
        pointsLift,
      };
    }
  }

  return best;
}

function buildAlert(
  input: Omit<VotingSecurityAlert, 'countedVoteIds' | 'excludedVoteIds' | 'allVoteIds' | 'participants'> & {
    votes: SecurityVote[];
  }
): VotingSecurityAlert {
  const countedVoteIds = input.votes.filter((vote) => !vote.is_excluded).map((vote) => vote.id);
  const excludedVoteIds = input.votes.filter((vote) => Boolean(vote.is_excluded)).map((vote) => vote.id);

  return {
    id: input.id,
    kind: input.kind,
    level: input.level,
    title: input.title,
    description: input.description,
    targetSongId: input.targetSongId,
    targetSong: input.targetSong,
    voteCount: input.voteCount,
    countedVoteIds,
    excludedVoteIds,
    allVoteIds: input.votes.map((vote) => vote.id),
    selectionPct: input.selectionPct,
    averagePoints: input.averagePoints,
    baselineAveragePoints: input.baselineAveragePoints,
    pointsLift: input.pointsLift,
    domain: input.domain,
    ipGroup: input.ipGroup,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    participants: input.votes
      .map(participant)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
  };
}

function overlapRatio(a: string[], b: string[]) {
  const aSet = new Set(a);
  const intersection = b.filter((value) => aSet.has(value)).length;
  return intersection / Math.max(1, Math.min(a.length, b.length));
}

export async function getVotingSecurityReport(roundId: string): Promise<VotingSecurityReport> {
  const sb = getSupabaseAdminClient();
  const errors: string[] = [];

  const empty: VotingSecurityReport = {
    roundId,
    trackingConfigured: isVotingIpTrackingConfigured(),
    ipColumnAvailable: false,
    verifiedVotes: 0,
    countedVotes: 0,
    trackedVerifiedVotes: 0,
    activeAlerts: [],
    resolvedAlerts: [],
    errors,
  };

  if (!sb) {
    errors.push('Supabase ist nicht konfiguriert.');
    return empty;
  }

  let ipColumnAvailable = true;
  let voteRows: SecurityVote[] = [];

  const voteSelectWithIp = await sb
    .from('release_voting_votes')
    .select('id,juror_name,juror_email,is_verified,is_excluded,created_at,verified_at,ip_hash')
    .eq('round_id', roundId)
    .eq('voting_channel', 'audience')
    .eq('is_verified', true)
    .order('created_at', { ascending: true });

  if (voteSelectWithIp.error && isMissingIpHashColumn(voteSelectWithIp.error)) {
    ipColumnAvailable = false;
    const fallback = await sb
      .from('release_voting_votes')
      .select('id,juror_name,juror_email,is_verified,is_excluded,created_at,verified_at')
      .eq('round_id', roundId)
      .eq('voting_channel', 'audience')
      .eq('is_verified', true)
      .order('created_at', { ascending: true });

    if (fallback.error) {
      errors.push(errorMessage(fallback.error));
      return { ...empty, ipColumnAvailable: false };
    }

    voteRows = ((fallback.data || []) as Omit<SecurityVote, 'ip_hash'>[]).map((vote) => ({
      ...vote,
      ip_hash: null,
    }));
  } else if (voteSelectWithIp.error) {
    errors.push(errorMessage(voteSelectWithIp.error));
    return { ...empty, ipColumnAvailable };
  } else {
    voteRows = (voteSelectWithIp.data || []) as SecurityVote[];
  }

  const { data: songRows, error: songError } = await sb
    .from('release_voting_songs')
    .select('id,title,artist')
    .eq('round_id', roundId);

  if (songError) {
    errors.push(errorMessage(songError));
    return {
      ...empty,
      ipColumnAvailable,
      verifiedVotes: voteRows.length,
      countedVotes: voteRows.filter((vote) => !vote.is_excluded).length,
      trackedVerifiedVotes: voteRows.filter((vote) => Boolean(vote.ip_hash)).length,
    };
  }

  const songs = (songRows || []) as SecuritySong[];
  const voteIds = voteRows.map((vote) => vote.id);
  let itemRows: SecurityVoteItem[] = [];

  if (voteIds.length) {
    const { data, error } = await sb
      .from('release_voting_vote_items')
      .select('vote_id,song_id,points')
      .in('vote_id', voteIds);

    if (error) {
      errors.push(errorMessage(error));
    } else {
      itemRows = (data || []) as SecurityVoteItem[];
    }
  }

  const itemsByVote = new Map<string, Map<string, number>>();
  for (const item of itemRows) {
    const bySong = itemsByVote.get(item.vote_id) || new Map<string, number>();
    const points = Number(item.points || 0);
    const existing = Number(bySong.get(item.song_id) || 0);
    if (points > existing) bySong.set(item.song_id, points);
    itemsByVote.set(item.vote_id, bySong);
  }

  const alerts: VotingSecurityAlert[] = [];

  // 1) Same round-scoped IP hash. No alert for a normal household-sized cluster unless
  // the voting pattern also strongly favors one song.
  const byIp = new Map<string, SecurityVote[]>();
  for (const vote of voteRows) {
    if (!vote.ip_hash) continue;
    const group = byIp.get(vote.ip_hash) || [];
    group.push(vote);
    byIp.set(vote.ip_hash, group);
  }

  for (const [ipHash, votes] of byIp.entries()) {
    if (votes.length < 3) continue;
    const signal = groupSignal(votes, voteRows, itemsByVote, songs);
    const strongBias = signal.selectionPct >= 70 && signal.pointsLift >= 2.5 && signal.averagePoints >= 4;
    const extremeBias = signal.selectionPct >= 85 && signal.pointsLift >= 4;
    const unusuallyLarge = votes.length >= 8;

    if (!unusuallyLarge && !(votes.length >= 4 && strongBias) && !(votes.length >= 3 && extremeBias)) {
      continue;
    }

    const level: VotingSecurityLevel =
      (votes.length >= 8 && strongBias) || (votes.length >= 5 && extremeBias)
        ? 'high'
        : 'warning';

    alerts.push(buildAlert({
      id: `ip:${ipHash.slice(0, 16)}`,
      kind: 'ip_cluster',
      level,
      title: 'Mehrere bestätigte Stimmen vom selben Anschluss',
      description: strongBias
        ? `${votes.length} bestätigte Stimmen stammen vom selben anonymisierten Anschluss und bevorzugen zusätzlich denselben Song ungewöhnlich stark.`
        : `${votes.length} bestätigte Stimmen stammen vom selben anonymisierten Anschluss. Das kann z. B. ein Haushalt, Büro oder gemeinsames WLAN sein und ist allein kein Manipulationsbeweis.`,
      targetSongId: signal.songId,
      targetSong: signal.songLabel,
      voteCount: votes.length,
      selectionPct: round1(signal.selectionPct),
      averagePoints: round2(signal.averagePoints),
      baselineAveragePoints: round2(signal.baselineAveragePoints),
      pointsLift: round2(signal.pointsLift),
      domain: null,
      ipGroup: ipHash.slice(0, 8),
      windowStart: votes[0]?.created_at || null,
      windowEnd: votes[votes.length - 1]?.created_at || null,
      votes,
    }));
  }

  // 2) Email-domain clusters. Common mass providers are explicitly excluded from
  // domain-only alerts, regardless of how many Gmail/GMX/etc. voters participate.
  const byDomain = new Map<string, SecurityVote[]>();
  for (const vote of voteRows) {
    const domain = emailDomain(vote.juror_email);
    if (!domain || COMMON_EMAIL_DOMAINS.has(domain)) continue;
    const group = byDomain.get(domain) || [];
    group.push(vote);
    byDomain.set(domain, group);
  }

  for (const [domain, votes] of byDomain.entries()) {
    if (votes.length < 4) continue;
    const signal = groupSignal(votes, voteRows, itemsByVote, songs);
    const suspiciousBias = signal.selectionPct >= 65 && signal.pointsLift >= 2.5 && signal.averagePoints >= 3.5;
    if (!suspiciousBias) continue;

    const firstTs = Date.parse(votes[0]?.created_at || '');
    const lastTs = Date.parse(votes[votes.length - 1]?.created_at || '');
    const spanHours = Number.isFinite(firstTs) && Number.isFinite(lastTs)
      ? Math.max(0, (lastTs - firstTs) / (60 * 60 * 1000))
      : 999;

    const level: VotingSecurityLevel =
      (votes.length >= 8 && signal.pointsLift >= 4) || (votes.length >= 12 && spanHours <= 6)
        ? 'high'
        : 'warning';

    alerts.push(buildAlert({
      id: `domain:${domain}`,
      kind: 'domain_cluster',
      level,
      title: `Auffälliges Abstimmungsmuster bei ${domain}`,
      description: `${votes.length} bestätigte Stimmen derselben weniger verbreiteten Mail-Domain zeigen ein deutlich ähnliches Punkte-Muster. Die Domain allein ist ausdrücklich kein Ausschlussgrund.`,
      targetSongId: signal.songId,
      targetSong: signal.songLabel,
      voteCount: votes.length,
      selectionPct: round1(signal.selectionPct),
      averagePoints: round2(signal.averagePoints),
      baselineAveragePoints: round2(signal.baselineAveragePoints),
      pointsLift: round2(signal.pointsLift),
      domain,
      ipGroup: null,
      windowStart: votes[0]?.created_at || null,
      windowEnd: votes[votes.length - 1]?.created_at || null,
      votes,
    }));
  }

  // 3) Short voting bursts across any email provider. Only counted votes are used,
  // and a large burst is not enough by itself: the group must also favor one song
  // much more strongly than the rest of the electorate.
  const countedVotes = voteRows.filter((vote) => !vote.is_excluded);
  const sortedCounted = [...countedVotes].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const burstCandidates: VotingSecurityAlert[] = [];
  const windowMs = 20 * 60 * 1000;

  for (let start = 0; start < sortedCounted.length; start += 1) {
    const startTime = Date.parse(sortedCounted[start]?.created_at || '');
    if (!Number.isFinite(startTime)) continue;

    const windowVotes: SecurityVote[] = [];
    for (let end = start; end < sortedCounted.length; end += 1) {
      const endTime = Date.parse(sortedCounted[end]?.created_at || '');
      if (!Number.isFinite(endTime) || endTime - startTime > windowMs) break;
      windowVotes.push(sortedCounted[end]);
    }

    if (windowVotes.length < 8) continue;
    const signal = groupSignal(windowVotes, voteRows, itemsByVote, songs);
    if (signal.selectionPct < 75 || signal.pointsLift < 3 || signal.averagePoints < 5) continue;

    const level: VotingSecurityLevel =
      windowVotes.length >= 12 && signal.pointsLift >= 4
        ? 'high'
        : 'warning';

    burstCandidates.push(buildAlert({
      id: `time:${windowVotes[0].id}:${windowVotes[windowVotes.length - 1].id}`,
      kind: 'time_cluster',
      level,
      title: 'Auffälliger Voting-Burst',
      description: `${windowVotes.length} noch gewertete Stimmen kamen innerhalb von höchstens 20 Minuten und bewerteten denselben Song deutlich stärker als das übrige Publikum. Das kann auch durch legitime Fan-Mobilisierung entstehen und muss manuell geprüft werden.`,
      targetSongId: signal.songId,
      targetSong: signal.songLabel,
      voteCount: windowVotes.length,
      selectionPct: round1(signal.selectionPct),
      averagePoints: round2(signal.averagePoints),
      baselineAveragePoints: round2(signal.baselineAveragePoints),
      pointsLift: round2(signal.pointsLift),
      domain: null,
      ipGroup: null,
      windowStart: windowVotes[0]?.created_at || null,
      windowEnd: windowVotes[windowVotes.length - 1]?.created_at || null,
      votes: windowVotes,
    }));
  }

  burstCandidates.sort((a, b) => {
    const aScore = (a.pointsLift || 0) * a.voteCount;
    const bScore = (b.pointsLift || 0) * b.voteCount;
    return bScore - aScore;
  });

  const acceptedBursts: VotingSecurityAlert[] = [];
  for (const candidate of burstCandidates) {
    const duplicate = acceptedBursts.some(
      (existing) =>
        existing.targetSongId === candidate.targetSongId &&
        overlapRatio(existing.allVoteIds, candidate.allVoteIds) >= 0.6
    );
    if (duplicate) continue;
    acceptedBursts.push(candidate);
    if (acceptedBursts.length >= 3) break;
  }
  alerts.push(...acceptedBursts);

  // Prefer the stronger signal if the same group is caught in multiple ways.
  alerts.sort((a, b) => {
    const activeA = a.countedVoteIds.length ? 1 : 0;
    const activeB = b.countedVoteIds.length ? 1 : 0;
    if (activeA !== activeB) return activeB - activeA;
    if (levelWeight(a.level) !== levelWeight(b.level)) return levelWeight(b.level) - levelWeight(a.level);
    return b.voteCount - a.voteCount;
  });

  return {
    roundId,
    trackingConfigured: isVotingIpTrackingConfigured(),
    ipColumnAvailable,
    verifiedVotes: voteRows.length,
    countedVotes: countedVotes.length,
    trackedVerifiedVotes: voteRows.filter((vote) => Boolean(vote.ip_hash)).length,
    activeAlerts: alerts.filter((alert) => alert.countedVoteIds.length > 0),
    resolvedAlerts: alerts.filter((alert) => alert.countedVoteIds.length === 0),
    errors,
  };
}
