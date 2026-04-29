import { createHash, randomBytes } from 'node:crypto';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import type { VoteRow } from '@/lib/releaseVoting';

function getResendApiKey() {
  return (process.env.RESEND_API_KEY ?? '').trim();
}

function getFromEmail() {
  return (process.env.RESEND_FROM_EMAIL ?? '').trim();
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').trim().replace(/\/$/, '');
}

function getVerifySecret() {
  return (process.env.VOTE_VERIFY_SECRET ?? '').trim();
}

export function getEmailVerificationConfigState() {
  if (!getResendApiKey()) {
    return { ok: false as const, message: 'RESEND_API_KEY fehlt.' };
  }
  if (!getFromEmail()) {
    return { ok: false as const, message: 'RESEND_FROM_EMAIL fehlt.' };
  }
  if (!getAppUrl()) {
    return { ok: false as const, message: 'NEXT_PUBLIC_APP_URL fehlt.' };
  }
  if (!getVerifySecret()) {
    return { ok: false as const, message: 'VOTE_VERIFY_SECRET fehlt.' };
  }
  return { ok: true as const, message: 'E-Mail-Verifizierung ist konfiguriert.' };
}

export function createVerificationToken() {
  return randomBytes(32).toString('hex');
}

export function hashVerificationToken(token: string) {
  return createHash('sha256')
    .update(`${token}.${getVerifySecret()}`)
    .digest('hex');
}

export function createVerificationWindow(hours = 48) {
  const now = new Date();
  const expires = new Date(now.getTime() + hours * 60 * 60 * 1000);
  return {
    sentAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

export function buildVerificationUrl(token: string) {
  return `${getAppUrl()}/release-voting/verify?token=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(input: {
  to: string;
  roundTitle: string;
  verificationUrl: string;
}) {
  const config = getEmailVerificationConfigState();
  if (!config.ok) {
    throw new Error(config.message);
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Knallhart serviert Publikums-Voting <${getFromEmail()}>`,
      to: [input.to],
      subject: 'Bitte bestätige dein Voting',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
          <h2 style="margin: 0 0 12px;">Knallhart serviert Publikums-Voting</h2>
          <p>Danke für dein Voting für <strong>${escapeHtml(input.roundTitle)}</strong>.</p>
          <p>Bitte bestätige deine Stimme mit einem Klick auf diesen Button:</p>
          <p style="margin: 24px 0;">
            <a href="${input.verificationUrl}" style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #ff6b3d; color: #ffffff; text-decoration: none; font-weight: 700;">Voting bestätigen</a>
          </p>
          <p>Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:</p>
          <p><a href="${input.verificationUrl}">${input.verificationUrl}</a></p>
          <p style="font-size: 13px; color: #64748b;">Nur bestätigte Stimmen fließen in die Auswertung ein.</p>
        </div>
      `,
      text: `Danke für dein Voting für "${input.roundTitle}". Bitte bestätige deine Stimme über diesen Link: ${input.verificationUrl}`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bestätigungs-Mail konnte nicht gesendet werden: ${text}`);
  }
}

export async function verifyVoteToken(token: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false as const, message: 'Supabase-Client konnte nicht erstellt werden.' };
  }

  const tokenHash = hashVerificationToken(token);
  const { data, error } = await supabase
    .from('release_voting_votes')
    .select('*')
    .eq('verify_token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    return { ok: false as const, message: error.message };
  }

  const vote = data as VoteRow | null;

  if (!vote) {
    return { ok: false as const, message: 'Der Bestätigungslink ist ungültig oder wurde bereits verwendet.' };
  }

  if (vote.is_verified) {
    return { ok: true as const, message: 'Diese Stimme wurde bereits bestätigt.' };
  }

  if (vote.verify_expires_at) {
    const expiresAt = new Date(vote.verify_expires_at).getTime();
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
      return { ok: false as const, message: 'Der Bestätigungslink ist abgelaufen. Bitte sende dein Voting erneut ab.' };
    }
  }

  const update = await supabase
    .from('release_voting_votes')
    .update({
      is_verified: true,
      verified_at: new Date().toISOString(),
      verify_expires_at: null,
    })
    .eq('id', vote.id);

  if (update.error) {
    return { ok: false as const, message: update.error.message };
  }

  return { ok: true as const, message: 'Dein Voting wurde bestätigt.' };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
