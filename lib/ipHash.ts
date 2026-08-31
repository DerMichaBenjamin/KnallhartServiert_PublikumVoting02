import 'server-only';

import { createHmac } from 'crypto';

export function isVotingIpTrackingConfigured() {
  return Boolean(String(process.env.VOTING_IP_HASH_SECRET || '').trim());
}

export function hashVotingIpForRound(roundId: string, ip: string) {
  const secret = String(process.env.VOTING_IP_HASH_SECRET || '').trim();
  const normalizedRoundId = String(roundId || '').trim();
  const normalizedIp = String(ip || '').trim();

  if (!secret || !normalizedRoundId || !normalizedIp || normalizedIp === 'unknown') {
    return null;
  }

  // Round-scoped HMAC: the same connection cannot be linked across different voting rounds.
  return createHmac('sha256', secret)
    .update(`${normalizedRoundId}:${normalizedIp}`)
    .digest('hex');
}
