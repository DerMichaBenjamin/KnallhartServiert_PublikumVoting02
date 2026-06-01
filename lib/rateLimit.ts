import 'server-only';

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

function getStore() {
  const globalStore = globalThis as typeof globalThis & { __KHS_RATE_LIMITS__?: Map<string, Bucket> };
  if (!globalStore.__KHS_RATE_LIMITS__) globalStore.__KHS_RATE_LIMITS__ = new Map<string, Bucket>();
  return globalStore.__KHS_RATE_LIMITS__;
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: Math.max(0, limit - 1), resetAt };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  store.set(key, existing);
  return { ok: true, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
}

export function clientIpFromRequest(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  const firstForwarded = forwardedFor.split(',')[0]?.trim();
  return (
    firstForwarded ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export function minutesUntil(resetAt: number) {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 60000));
}
