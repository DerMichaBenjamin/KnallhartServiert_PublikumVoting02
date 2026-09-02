import type { Round } from './releaseVotingShared';

export const STATISTICS_TEST_PATTERN = '%test%';

/**
 * Test-Runden bleiben vollständig in der Datenbank und in der allgemeinen
 * Umfragenverwaltung erhalten. Nur redaktionelle Statistiken und Exporte
 * blenden Einträge aus, deren Titel oder Slug ausdrücklich "test" enthält.
 */
export function isStatisticsTestRound(round: Pick<Round, 'title' | 'slug'>) {
  return `${round.title || ''}\n${round.slug || ''}`.toLocaleLowerCase('de-DE').includes('test');
}

export function keepForReleaseStatistics(round: Pick<Round, 'title' | 'slug'>) {
  return !isStatisticsTestRound(round);
}
