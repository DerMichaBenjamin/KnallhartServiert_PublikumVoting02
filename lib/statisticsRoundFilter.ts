import type { Round } from './releaseVotingShared';

export const STATISTICS_TEST_PATTERN = '%test%';
export const STATISTICS_LEGACY_DJ_PATTERN = '%dj%';

/**
 * Test-Runden bleiben vollständig in der Datenbank und in der allgemeinen
 * Umfragenverwaltung erhalten. Nur redaktionelle Statistiken und Exporte
 * blenden Einträge aus, deren Titel oder Slug ausdrücklich "test" enthält.
 */
export function isStatisticsTestRound(round: Pick<Round, 'title' | 'slug'>) {
  return `${round.title || ''}\n${round.slug || ''}`.toLocaleLowerCase('de-DE').includes('test');
}

/**
 * Vor der Kanaltrennung wurden DJ-Abstimmungen teilweise als eigene Runden
 * gespeichert. Ihre Titel/Slugs tragen durchgehend einen eigenständigen
 * DJ-Marker (z. B. "DJ-Voting", "DJ Bewertung" oder "... DJs"). Diese
 * Altrunden bleiben in der Datenbank und im DJ-Bereich erhalten, zählen aber
 * nicht als normale Release-Check-Woche.
 *
 * Aktuelle kombinierte Runden werden nicht ausgeschlossen: Dort liegen die
 * DJ-Stimmen im Kanal `dj`, während Publikum und Jury derselben Woche weiter
 * regulär ausgewertet werden.
 */
export function isLegacyDjStatisticsRound(round: Pick<Round, 'title' | 'slug'>) {
  const normalized = `${round.title || ''}\n${round.slug || ''}`
    .toLocaleLowerCase('de-DE')
    .replace(/[‐‑‒–—―−_./:-]+/g, ' ');
  return normalized.split(/\s+/).some((token) => token === 'dj' || token === 'djs');
}

export function keepForReleaseStatistics(round: Pick<Round, 'title' | 'slug'>) {
  return !isStatisticsTestRound(round) && !isLegacyDjStatisticsRound(round);
}
