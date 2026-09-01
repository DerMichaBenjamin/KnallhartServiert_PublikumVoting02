import 'server-only';

import { createHash } from 'node:crypto';
import { getSupabaseAdminClient } from './supabaseAdmin';

export type IntegrityStatus = 'clear' | 'review' | 'approved' | 'excluded';

export type RankingFingerprintEntry = {
  songId: string;
  points: number;
};

export type VoteIntegrityAssessment = {
  emailDomain: string;
  ipHash: string | null;
  rankingHash: string;
  reasons: string[];
  status: 'clear' | 'review';
  isCounted: boolean;
};

type DisposableCache = {
  domains: Set<string>;
  loadedAt: number;
};

const DISPOSABLE_LIST_URL = 'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt';
const DISPOSABLE_CACHE_MS = 6 * 60 * 60 * 1000;

// Fallback if the maintained list cannot be fetched during a serverless cold start.
// atomicmail.io is intentionally treated as a review flag for this voting project,
// because it allows anonymous/alias use and was already part of the manual fraud review workflow.
const FALLBACK_DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  '10minutesemail.net',
  '20minutemail.com',
  'atomicmail.io',
  'discard.email',
  'discardmail.com',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mintemail.com',
  'moakt.com',
  'mytemp.email',
  'sharklasers.com',
  'spamgourmet.com',
  'temp-mail.org',
  'tempail.com',
  'tempmail.com',
  'tempmail.net',
  'tempmailo.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
]);

function integritySecret() {
  return (
    process.env.VOTE_INTEGRITY_SECRET?.trim()
    || process.env.VOTE_VERIFY_SECRET?.trim()
    || process.env.ADMIN_SESSION_SECRET?.trim()
    || process.env.ADMIN_PASSWORD?.trim()
    || 'khs-integrity-fallback'
  );
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function emailDomainFromAddress(email: string) {
  const value = String(email || '').trim().toLowerCase();
  const at = value.lastIndexOf('@');
  return at >= 0 ? value.slice(at + 1).trim() : '';
}

export function hashClientIp(ip: string) {
  const clean = String(ip || '').trim();
  if (!clean || clean === 'unknown') return null;
  return sha256(`${clean}|${integritySecret()}`);
}

export function buildRankingHash(ranking: RankingFingerprintEntry[]) {
  const normalized = [...ranking]
    .map((entry) => ({ songId: String(entry.songId || '').trim(), points: Number(entry.points) }))
    .filter((entry) => entry.songId && Number.isFinite(entry.points))
    .sort((a, b) => b.points - a.points || a.songId.localeCompare(b.songId))
    .map((entry) => `${entry.songId}:${entry.points}`)
    .join('|');

  return sha256(normalized);
}

function getDisposableCache() {
  const globalStore = globalThis as typeof globalThis & { __KHS_DISPOSABLE_EMAIL_CACHE__?: DisposableCache };
  return globalStore;
}

async function disposableDomains() {
  const globalStore = getDisposableCache();
  const cached = globalStore.__KHS_DISPOSABLE_EMAIL_CACHE__;
  if (cached && Date.now() - cached.loadedAt < DISPOSABLE_CACHE_MS) return cached.domains;

  const domains = new Set(FALLBACK_DISPOSABLE_DOMAINS);

  try {
    const response = await fetch(DISPOSABLE_LIST_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1600),
      headers: { 'user-agent': 'KnallhartServiert-VoteIntegrity/1.0' },
    });

    if (response.ok) {
      const text = await response.text();
      for (const line of text.split(/\r?\n/)) {
        const domain = line.trim().toLowerCase();
        if (domain && !domain.startsWith('#')) domains.add(domain);
      }
    }
  } catch {
    // Fallback list keeps voting operational if the external list is unavailable.
  }

  globalStore.__KHS_DISPOSABLE_EMAIL_CACHE__ = { domains, loadedAt: Date.now() };
  return domains;
}

async function isDisposableDomain(domain: string) {
  if (!domain) return false;
  const domains = await disposableDomains();
  return domains.has(domain.toLowerCase());
}

function uniqueReasons(reasons: string[]) {
  return [...new Set(reasons.filter(Boolean))];
}

export async function assessVoteIntegrity(input: {
  roundId: string;
  email: string;
  clientIp?: string | null;
  ipHash?: string | null;
  ranking: RankingFingerprintEntry[];
  excludeVoteId?: string | null;
}): Promise<VoteIntegrityAssessment> {
  const sb = getSupabaseAdminClient();
  const emailDomain = emailDomainFromAddress(input.email);
  const ipHash = input.ipHash ?? hashClientIp(input.clientIp || '');
  const rankingHash = buildRankingHash(input.ranking);
  const reasons: string[] = [];

  if (await isDisposableDomain(emailDomain)) {
    reasons.push(`Wegwerf-/Alias-E-Mail-Domain: ${emailDomain}`);
  }

  if (sb && ipHash) {
    let verifiedQuery = sb
      .from('release_voting_votes')
      .select('id,ranking_hash,is_verified,is_counted,integrity_status')
      .eq('round_id', input.roundId)
      .eq('ip_hash', ipHash)
      .eq('is_verified', true);

    if (input.excludeVoteId) verifiedQuery = verifiedQuery.neq('id', input.excludeVoteId);
    const { data: sameIpVerified } = await verifiedQuery.limit(25);
    const verifiedRows = sameIpVerified || [];

    if (verifiedRows.some((row) => row.ranking_hash && row.ranking_hash === rankingHash)) {
      reasons.push('Identische Rangliste wurde bereits über dieselbe Verbindung bestätigt.');
    }

    if (verifiedRows.length >= 2) {
      reasons.push(`Mehrere bestätigte Stimmen über dieselbe Verbindung (${verifiedRows.length + 1}. Stimme).`);
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let recentQuery = sb
      .from('release_voting_votes')
      .select('id', { count: 'exact', head: true })
      .eq('round_id', input.roundId)
      .eq('ip_hash', ipHash)
      .gte('created_at', oneHourAgo);

    if (input.excludeVoteId) recentQuery = recentQuery.neq('id', input.excludeVoteId);
    const { count: recentCount } = await recentQuery;

    if ((recentCount || 0) >= 4) {
      reasons.push(`Viele Voting-Versuche über dieselbe Verbindung innerhalb einer Stunde (${(recentCount || 0) + 1}).`);
    }
  }

  const cleanReasons = uniqueReasons(reasons);
  const status = cleanReasons.length ? 'review' : 'clear';

  return {
    emailDomain,
    ipHash,
    rankingHash,
    reasons: cleanReasons,
    status,
    isCounted: status === 'clear',
  };
}

export async function recheckVoteIntegrityAfterVerification(voteId: string) {
  const sb = getSupabaseAdminClient();
  if (!sb) return;

  const { data: vote, error: voteError } = await sb
    .from('release_voting_votes')
    .select('id,round_id,juror_email,ip_hash,ranking_hash,integrity_status')
    .eq('id', voteId)
    .maybeSingle();

  if (voteError || !vote) return;
  if (vote.integrity_status === 'approved' || vote.integrity_status === 'excluded') return;

  const { data: items, error: itemsError } = await sb
    .from('release_voting_vote_items')
    .select('song_id,points')
    .eq('vote_id', voteId);

  if (itemsError) return;

  const ranking = (items || []).map((item) => ({
    songId: String(item.song_id || ''),
    points: Number(item.points),
  }));

  const assessment = await assessVoteIntegrity({
    roundId: String(vote.round_id || ''),
    email: String(vote.juror_email || ''),
    ipHash: vote.ip_hash || null,
    ranking,
    excludeVoteId: voteId,
  });

  await sb
    .from('release_voting_votes')
    .update({
      email_domain: assessment.emailDomain,
      ranking_hash: assessment.rankingHash,
      integrity_status: assessment.status,
      integrity_reasons: assessment.reasons,
      is_counted: assessment.isCounted,
      integrity_updated_at: new Date().toISOString(),
    })
    .eq('id', voteId)
    .neq('integrity_status', 'approved')
    .neq('integrity_status', 'excluded');
}
