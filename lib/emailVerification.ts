import 'server-only';

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

export function getConfiguredAppOrigin() {
  const origin = normalizeOrigin(env('NEXT_PUBLIC_APP_URL'));

  if (!origin) {
    throw new Error('NEXT_PUBLIC_APP_URL fehlt oder ist ungültig. Trage in Vercel die feste öffentliche App-URL ein, z. B. https://knallhart-serviert-publikum-voting.vercel.app');
  }

  return origin;
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

export function buildVerificationUrl(token: string) {
  const base = getConfiguredAppOrigin();
  const path = `/release-voting/verify?token=${encodeURIComponent(token)}`;
  return `${base}${path}`;
}

function escapeHtml(value: string) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type VerificationEmailSelection = {
  title: string;
  artist: string;
  points: number;
};

type SendVerificationEmailInput = {
  to: string;
  roundTitle: string;
  verificationUrl: string;
  selections?: VerificationEmailSelection[];
  zonkSelection?: { title: string; artist: string } | null;
};

function formatSongLine(song: { title: string; artist?: string | null }) {
  return song.artist ? `${song.title} — ${song.artist}` : song.title;
}

function buildVoteSummaryHtml(selections: VerificationEmailSelection[] = [], zonkSelection?: { title: string; artist: string } | null) {
  if (!selections.length && !zonkSelection) return '';

  const rows = [...selections]
    .sort((a, b) => b.points - a.points || formatSongLine(a).localeCompare(formatSongLine(b)))
    .map((selection) => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#64748b;text-align:right;width:70px">${selection.points}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb"><strong>${escapeHtml(selection.title)}</strong>${selection.artist ? `<br><span style="color:#64748b;font-size:13px">${escapeHtml(selection.artist)}</span>` : ''}</td>
      </tr>
    `).join('');

  const rankingBlock = selections.length
    ? `<h3 style="margin:24px 0 8px;font-size:18px">Deine Punktevergabe</h3>
      <p style="margin:0 0 10px;color:#475569">Nach deiner Bestätigung werden diese Punkte in die Auswertung übernommen.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
        <thead>
          <tr>
            <th align="right" style="padding:8px 10px;background:#f8fafc;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em;width:70px">Punkte</th>
            <th align="left" style="padding:8px 10px;background:#f8fafc;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em">Song</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
    : '';

  const zonkBlock = zonkSelection
    ? `<p style="margin:18px 0 0"><strong>ZONK – Song der Woche:</strong><br>${escapeHtml(formatSongLine(zonkSelection))}</p>`
    : `<p style="margin:18px 0 0;color:#64748b"><strong>ZONK – Song der Woche:</strong><br>Kein ZONK gewählt.</p>`;

  return `${rankingBlock}${zonkBlock}`;
}

function buildVoteSummaryText(selections: VerificationEmailSelection[] = [], zonkSelection?: { title: string; artist: string } | null) {
  const lines: string[] = [];

  if (selections.length) {
    lines.push('', 'Deine Punktevergabe:');
    for (const selection of [...selections].sort((a, b) => b.points - a.points || formatSongLine(a).localeCompare(formatSongLine(b)))) {
      lines.push(`${selection.points} Punkte: ${formatSongLine(selection)}`);
    }
  }

  lines.push('', `ZONK – Song der Woche: ${zonkSelection ? formatSongLine(zonkSelection) : 'Kein ZONK gewählt.'}`);

  return lines.join('\n');
}

export async function sendVerificationEmail(input: SendVerificationEmailInput) {
  const apiKey = env('RESEND_API_KEY');
  const fromEmail = env('RESEND_FROM_EMAIL');

  if (!apiKey || !fromEmail) {
    throw new Error('RESEND_API_KEY oder RESEND_FROM_EMAIL fehlt. Prüfe die Environment Variables in Vercel.');
  }

  const escapedUrl = escapeHtml(input.verificationUrl);
  const summaryHtml = buildVoteSummaryHtml(input.selections, input.zonkSelection);
  const summaryText = buildVoteSummaryText(input.selections, input.zonkSelection);

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
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:680px"><h2>Knallhart serviert Publikums-Voting</h2><p>Danke für dein Voting für <strong>${escapeHtml(input.roundTitle)}</strong>.</p><p>Bitte bestätige deine Stimme mit einem Klick:</p><p><a href="${escapedUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#ff6b3d;color:#fff;text-decoration:none;font-weight:700">Voting bestätigen</a></p>${summaryHtml}<p style="margin-top:22px;font-size:13px;color:#64748b">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:</p><p style="font-size:13px;word-break:break-all"><a href="${escapedUrl}">${escapedUrl}</a></p><p>Die Mail kann einige Minuten dauern. Prüfe bitte auch den Spam-Ordner.</p><p style="font-size:13px;color:#64748b">Nur bestätigte Stimmen fließen in die Auswertung ein.</p></div>`,
      text: `Danke für dein Voting für "${input.roundTitle}".\n\nBestätige hier: ${input.verificationUrl}${summaryText}\n\nNur bestätigte Stimmen fließen in die Auswertung ein.`,
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
