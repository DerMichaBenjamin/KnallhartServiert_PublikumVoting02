import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabaseAdmin';
import {
  buildVerificationUrl,
  createVerificationToken,
  hashVerificationToken,
  sendVerificationEmail,
  verificationWindow,
} from '@/lib/emailVerification';
import { checkRateLimit, clientIpFromRequest, minutesUntil } from '@/lib/rateLimit';
import { hashVotingIpForRound } from '@/lib/ipHash';

type RankingEntryInput = {
  songId?: unknown;
  points?: unknown;
};

type NormalizedRankingEntry = {
  songId: string;
  points: number;
};

type RoundSongRow = {
  id: string;
  title: string;
  artist: string;
};

function dbMessage(error: unknown) {
  if (!error) return 'Unbekannter Serverfehler.';
  if (error instanceof Error) return error.message;

  if (typeof error === 'object') {
    const e = error as Record<string, unknown>;

    return (
      [e.message, e.details, e.hint, e.code]
        .filter(Boolean)
        .map(String)
        .join(' | ') || 'Unbekannter Datenbankfehler.'
    );
  }

  return String(error);
}

function clean(value: unknown) {
  return String(value || '').trim();
}

function sinceIso(hours: number) {
  return new Date(
    Date.now() - hours * 60 * 60 * 1000
  ).toISOString();
}

function isMissingIpHashColumn(error: unknown) {
  const message = dbMessage(error).toLowerCase();

  return (
    message.includes('ip_hash') &&
    (
      message.includes('column') ||
      message.includes('schema cache') ||
      message.includes('does not exist') ||
      message.includes('could not find')
    )
  );
}

export async function POST(req: Request) {
  let createdVoteId: string | null = null;

  try {
    const body = await req.json();

    const sb = getSupabaseAdminClient();

    if (!sb) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Supabase nicht konfiguriert. Prüfe NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 500 }
      );
    }

    const roundId = clean(body.roundId);
    const jurorName = clean(body.jurorName);
    const jurorEmail = clean(body.jurorEmail).toLowerCase();
    const jurorInstagram =
      clean(body.jurorInstagram) || null;
    const zonkSongId =
      clean(body.zonkSongId) || null;
    const honeypot = clean(body.website);

    const ranking: RankingEntryInput[] =
      Array.isArray(body.ranking)
        ? (body.ranking as RankingEntryInput[])
        : [];

    if (honeypot) {
      throw new Error(
        'Dieses Voting wurde als automatisierter Spam erkannt.'
      );
    }

    if (!roundId) {
      throw new Error(
        'Umfrage-ID fehlt. Bitte Seite neu laden.'
      );
    }

    if (!jurorName) {
      throw new Error(
        'Bitte gib deinen Namen ein.'
      );
    }

    if (
      !jurorEmail ||
      !jurorEmail.includes('@')
    ) {
      throw new Error(
        'Bitte gib eine gültige E-Mail-Adresse ein.'
      );
    }

    if (!ranking.length) {
      throw new Error(
        'Bitte wähle deine Songs aus.'
      );
    }

    /*
     * IP wird NICHT als Klartext gespeichert.
     * Stattdessen wird ein rundenbezogener Hash erzeugt.
     */
    const clientIp =
      clientIpFromRequest(req);

    const ipHash =
      hashVotingIpForRound(
        roundId,
        clientIp
      );

    /*
     * Bestehendes kurzfristiges IP-Rate-Limit.
     * Dieses bleibt unabhängig vom neuen passiven
     * IP-Hash-Tracking bestehen.
     */
    const ipLimit = checkRateLimit(
      `vote-submit:ip:${roundId}:${clientIp}`,
      10,
      60 * 60 * 1000
    );

    if (!ipLimit.ok) {
      throw new Error(
        `Zu viele Voting-Versuche von diesem Anschluss. Bitte in ca. ${minutesUntil(
          ipLimit.resetAt
        )} Minuten erneut probieren.`
      );
    }

    const emailLimit =
      checkRateLimit(
        `vote-submit:email:${roundId}:${jurorEmail}`,
        3,
        60 * 60 * 1000
      );

    if (!emailLimit.ok) {
      throw new Error(
        `Zu viele Voting-Versuche mit dieser E-Mail-Adresse. Bitte in ca. ${minutesUntil(
          emailLimit.resetAt
        )} Minuten erneut probieren.`
      );
    }

    const {
      data: round,
      error: roundError,
    } = await sb
      .from('release_voting_rounds')
      .select(
        'id,title,status,starts_at,ends_at,places_count'
      )
      .eq('id', roundId)
      .maybeSingle();

    if (roundError) {
      throw roundError;
    }

    if (!round) {
      throw new Error(
        'Diese Umfrage wurde nicht gefunden. Bitte Seite neu laden.'
      );
    }

    const now = Date.now();

    const isLive =
      round.status === 'live' &&
      (
        !round.starts_at ||
        Date.parse(round.starts_at) <= now
      ) &&
      (
        !round.ends_at ||
        Date.parse(round.ends_at) >= now
      );

    if (!isLive) {
      throw new Error(
        'Diese Abstimmung ist aktuell nicht live. Bitte prüfe Startzeit, Endzeit und Status im Adminbereich.'
      );
    }

    if (
      ranking.length !==
      Number(round.places_count || 12)
    ) {
      throw new Error(
        `Bitte belege genau ${
          round.places_count || 12
        } Plätze.`
      );
    }

    /*
     * Dauerhafter zusätzlicher Schutz gegen
     * viele Versuche derselben Mailadresse.
     */
    const oneHourAgo =
      sinceIso(1);

    const {
      count: recentEmailAttempts,
      error: attemptsError,
    } = await sb
      .from('release_voting_votes')
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq('round_id', roundId)
      .eq('juror_email', jurorEmail)
      .gte(
        'created_at',
        oneHourAgo
      );

    if (attemptsError) {
      throw attemptsError;
    }

    if (
      (recentEmailAttempts || 0) >= 3
    ) {
      throw new Error(
        'Mit dieser E-Mail-Adresse wurden in der letzten Stunde bereits zu viele Voting-Versuche gestartet. Bitte später erneut probieren.'
      );
    }

    /*
     * Nur eine bestätigte Stimme pro
     * Mailadresse und Abstimmung.
     */
    const {
      data: existingVerifiedVote,
      error: existingVerifiedError,
    } = await sb
      .from('release_voting_votes')
      .select('id')
      .eq('round_id', roundId)
      .eq('juror_email', jurorEmail)
      .eq('is_verified', true)
      .limit(1)
      .maybeSingle();

    if (existingVerifiedError) {
      throw existingVerifiedError;
    }

    if (
      existingVerifiedVote?.id
    ) {
      throw new Error(
        'Diese E-Mail-Adresse hat für diese Abstimmung bereits eine bestätigte Stimme abgegeben.'
      );
    }

    const normalizedRanking:
      NormalizedRankingEntry[] =
        ranking.map(
          (entry) => ({
            songId:
              clean(entry.songId),
            points:
              Number(entry.points),
          })
        );

    if (
      normalizedRanking.some(
        (
          entry:
            NormalizedRankingEntry
        ) =>
          !entry.songId ||
          !Number.isFinite(
            entry.points
          )
      )
    ) {
      throw new Error(
        'Die Song-Auswahl ist unvollständig. Bitte lade die Seite neu und stimme erneut ab.'
      );
    }

    const expectedPlaces =
      Number(
        round.places_count || 12
      );

    const songIds =
      normalizedRanking.map(
        (
          entry:
            NormalizedRankingEntry
        ) => entry.songId
      );

    const points =
      normalizedRanking.map(
        (
          entry:
            NormalizedRankingEntry
        ) => entry.points
      );

    const uniqueSongIds =
      new Set(songIds);

    const uniquePoints =
      new Set(points);

    const expectedPointSet =
      new Set(
        Array.from(
          {
            length:
              expectedPlaces,
          },
          (_, index) =>
            expectedPlaces -
            index
        )
      );

    if (
      uniqueSongIds.size !==
      normalizedRanking.length
    ) {
      throw new Error(
        'Ein Song wurde mehrfach ausgewählt. Bitte lade die Seite neu und stimme erneut ab.'
      );
    }

    if (
      uniquePoints.size !==
        normalizedRanking.length ||
      points.some(
        (point: number) =>
          !expectedPointSet.has(
            point
          )
      )
    ) {
      throw new Error(
        'Die Punktevergabe ist ungültig. Bitte lade die Seite neu und stimme erneut ab.'
      );
    }

    const {
      data: roundSongs,
      error: songsError,
    } = await sb
      .from(
        'release_voting_songs'
      )
      .select(
        'id,title,artist'
      )
      .eq(
        'round_id',
        roundId
      );

    if (songsError) {
      throw songsError;
    }

    const roundSongRows =
      (roundSongs ||
        []) as RoundSongRow[];

    const validSongIds =
      new Set(
        roundSongRows.map(
          (song) =>
            song.id
        )
      );

    const songsById =
      new Map(
        roundSongRows.map(
          (song) => [
            song.id,
            song,
          ]
        )
      );

    if (
      validSongIds.size <
      expectedPlaces
    ) {
      throw new Error(
        'Diese Abstimmung enthält weniger Songs als Plätze. Bitte Adminbereich prüfen.'
      );
    }

    if (
      normalizedRanking.some(
        (entry) =>
          !validSongIds.has(
            entry.songId
          )
      )
    ) {
      throw new Error(
        'Ungültige Song-Auswahl: Mindestens ein Song gehört nicht zu dieser Abstimmung. Bitte Seite neu laden.'
      );
    }

    if (
      zonkSongId &&
      !validSongIds.has(
        zonkSongId
      )
    ) {
      throw new Error(
        'Ungültige ZONK-Auswahl: Dieser Song gehört nicht zu dieser Abstimmung. Bitte Seite neu laden.'
      );
    }

    const token =
      createVerificationToken();

    const win =
      verificationWindow();

    /*
     * Basisdaten der Stimme.
     */
    const baseVotePayload = {
      round_id:
        roundId,

      juror_name:
        jurorName,

      juror_email:
        jurorEmail,

      juror_instagram:
        jurorInstagram,

      zonk_song_id:
        zonkSongId,

      is_verified:
        false,

      verify_token_hash:
        hashVerificationToken(
          token
        ),

      verify_sent_at:
        win.sentAt,

      verify_expires_at:
        win.expiresAt,
    };

    /*
     * NEU:
     * ip_hash wird nur ergänzt,
     * wenn ein Hash erzeugt werden konnte.
     *
     * "as any" betrifft hier ausschließlich
     * die lokale TypeScript-Prüfung des
     * Supabase-Payloads.
     */
    const votePayload =
      ipHash
        ? {
            ...baseVotePayload,
            ip_hash:
              ipHash,
          }
        : baseVotePayload;

    let voteInsert =
      await sb
        .from(
          'release_voting_votes'
        )
        .insert(
          votePayload as any
        )
        .select('id')
        .single();

    /*
     * Sicherheits-Fallback:
     *
     * Falls der Code versehentlich deployt
     * wird, bevor die optionale ip_hash-Spalte
     * in Supabase verfügbar ist, wird die Stimme
     * noch einmal OHNE ip_hash gespeichert.
     *
     * Dadurch soll das öffentliche Voting
     * nicht ausfallen.
     */
    if (
      voteInsert.error &&
      ipHash &&
      isMissingIpHashColumn(
        voteInsert.error
      )
    ) {
      voteInsert =
        await sb
          .from(
            'release_voting_votes'
          )
          .insert(
            baseVotePayload
          )
          .select('id')
          .single();
    }

    const {
      data: vote,
      error: voteError,
    } = voteInsert;

    if (voteError) {
      throw voteError;
    }

    if (!vote?.id) {
      throw new Error(
        'Stimme konnte nicht gespeichert werden. Keine Vote-ID erhalten.'
      );
    }

    createdVoteId =
      vote.id;

    /*
     * Ranking speichern.
     */
    const {
      error: itemsError,
    } = await sb
      .from(
        'release_voting_vote_items'
      )
      .insert(
        normalizedRanking.map(
          (
            entry:
              NormalizedRankingEntry
          ) => ({
            vote_id:
              vote.id,

            song_id:
              entry.songId,

            points:
              entry.points,
          })
        )
      );

    if (itemsError) {
      throw itemsError;
    }

    /*
     * Bestätigungs-E-Mail vorbereiten.
     */
    const verificationUrl =
      buildVerificationUrl(
        token
      );

    const selectionsForEmail =
      [
        ...normalizedRanking,
      ]
        .sort(
          (a, b) =>
            b.points -
            a.points
        )
        .map(
          (entry) => {
            const song =
              songsById.get(
                entry.songId
              );

            return {
              title:
                song?.title ||
                'Unbekannter Song',

              artist:
                song?.artist ||
                '',

              points:
                entry.points,
            };
          }
        );

    const zonkSongForEmail =
      zonkSongId
        ? songsById.get(
            zonkSongId
          ) || null
        : null;

    await sendVerificationEmail({
      to:
        jurorEmail,

      roundTitle:
        round.title ||
        'Knallhart serviert Publikums-Voting',

      verificationUrl,

      selections:
        selectionsForEmail,

      zonkSelection:
        zonkSongForEmail
          ? {
              title:
                zonkSongForEmail.title,

              artist:
                zonkSongForEmail.artist ||
                '',
            }
          : null,
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    /*
     * Wenn nach dem Erstellen der Vote-Zeile
     * etwas schiefgeht, wird die angefangene
     * Stimme wieder entfernt.
     */
    if (createdVoteId) {
      const sb =
        getSupabaseAdminClient();

      await sb
        ?.from(
          'release_voting_votes'
        )
        .delete()
        .eq(
          'id',
          createdVoteId
        );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          dbMessage(error),
      },
      {
        status: 500,
      }
    );
  }
}
