import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getSupabaseAdminClient } from './supabaseAdmin';

function env(name: string) {
  return (process.env[name] || '').trim();
}

function normalizeOrigin(value: string) {
  const raw = value.trim();
  if (!raw) return '';

  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return url.origin.replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function getRequestOrigin(req: Request) {
  const forwardedHost = req.headers.get('x-forwarded-host') || '';
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  const host = forwardedHost || req.headers.get('host') || '';

  if (host) return normalizeOrigin(`${forwardedProto}://${host}`);

  try {
    return new URL(req.url).origin.replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function createVerificationToken() {
  return randomBytes(32).toString('hex');
}

function hashWithSecret(token: string, secret: string) {
  return createHash('sha256').update(`${token}.${secret}`).digest('hex');
}

export function hashVerificationToken(token: string) {
  return hashWithSecret(token, env('VOTE_VERIFY_SECRET'));
}

export function candidateVerificationTokenHashes(token: string) {
  const hashes = new Set<string>();
  hashes.add(hashWithSecret(token, env('VOTE_VERIFY_SECRET')));
  hashes.add(hashWithSecret(token, ''));
  return [...hashes];
}

export function safeTokenEquals(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verificationWindow(hours = 48) {
  const now = new Date();
  return {
    sentAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + hours * 3600 * 1000).toISOString(),
  };
}

export function buildVerificationUrl(token: string, requestOrigin = '') {
  // Wichtig: Die echte Request-Domain hat Vorrang vor NEXT_PUBLIC_APP_URL.
  // Wenn NEXT_PUBLIC_APP_URL versehentlich mit Pfad gesetzt wurde, wird nur die Origin genutzt.
  const base = normalizeOrigin(requestOrigin) || normalizeOrigin(env('NEXT_PUBLIC_APP_URL'));
  const path = `/release-voting/verify?token=${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function sendVerificationEmail(input: { to: string; roundTitle: string; verificationUrl: string }) {
  const apiKey = env('RESEND_API_KEY');
  const fromEmail = env('RESEND_FROM_EMAIL');

  if (!apiKey || !fromEmail) {
    throw new Error('RESEND_API_KEY oder RESEND_FROM_EMAIL fehlt. Prüfe die Environment Variables in Vercel.');
  }

  const escapedUrl = escapeHtml(input.verificationUrl);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Knallhart serviert Publikums-Voting <${fromEmail}>`,
      to: [input.to],
      subject: 'Bitte bestätige dein Voting',
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937"><h2>Knallhart serviert Publikums-Voting</h2><p>Danke für dein Voting für <strong>${escapeHtml(input.roundTitle)}</strong>.</p><p>Bitte bestätige deine Stimme mit einem Klick:</p><p><a href="${escapedUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#ff6b3d;color:#fff;text-decoration:none;font-weight:700">Voting bestätigen</a></p><p style="margin-top:18px;font-size:13px;color:#64748b">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:</p><p style="font-size:13px;word-break:break-all"><a href="${escapedUrl}">${escapedUrl}</a></p><p>Die Mail kann einige Minuten dauern. Prüfe bitte auch den Spam-Ordner.</p><p style="font-size:13px;color:#64748b">Nur bestätigte Stimmen fließen in die Auswertung ein.</p></div>`,
      text: `Danke für dein Voting für "${input.roundTitle}". Bestätige hier: ${input.verificationUrl}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Bestätigungs-Mail konnte nicht gesendet werden: ${await response.text()}`);
  }
}

export async function verifyVoteToken(tokenInput: string) {
  const sb = getSupabaseAdminClient();
  if (!sb) return { ok: false as const, message: 'Supabase-Client konnte nicht erstellt werden.' };

  const token = tokenInput.trim();
  if (!token) return { ok: false as const, message: 'Der Bestätigungslink ist unvollständig.' };

  const tokenHashes = candidateVerificationTokenHashes(token);
  const { data, error } = await sb
    .from('release_voting_votes')
    .select('*')
    .in('verify_token_hash', tokenHashes)
    .maybeSingle();

  if (error) return { ok: false as const, message: error.message };
  if (!data) return { ok: false as const, message: 'Der Bestätigungslink ist ungültig oder wurde nicht gefunden. Bitte stimme erneut ab.' };
  if (data.is_verified) return { ok: true as const, message: 'Deine Stimme ist bereits bestätigt.' };
  if (data.verify_expires_at && Date.now() > new Date(data.verify_expires_at).getTime()) {
    return { ok: false as const, message: 'Der Link ist abgelaufen. Bitte stimme erneut ab.' };
  }

  const upd = await sb
    .from('release_voting_votes')
    .update({ is_verified: true, verified_at: new Date().toISOString(), verify_expires_at: null })
    .eq('id', data.id);

  if (upd.error) return { ok: false as const, message: upd.error.message };
  return { ok: true as const, message: 'Dein Voting wurde bestätigt.' };
}
