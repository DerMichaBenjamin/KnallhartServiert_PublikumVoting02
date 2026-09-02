import type { ReleaseStatisticsArchive } from './releaseStatistics';
import type { ArtistHistory, ReleaseWeekStatistics } from './releaseStatisticsCore';
import type { WorkbookSheet } from './tabularExport';

const RESULT_HEADERS = [
  'Umfrage-ID', 'Umfrage', 'Slug', 'Status', 'Start', 'Ende', 'Song-ID', 'Song', 'Künstler',
  'Gesamtplatz', 'Gesamtpunkte', 'Jury-Punkte Summe', 'Jury-Durchschnitt', 'Jury-Platz',
  'Publikum 12–1 Punkte', 'Publikumspunkte Rohwert', 'Publikumsnennungen', 'Publikumsplatz',
  'Abweichung Publikum/Jury', 'Polarisierungsindex', 'Polarisierungsbeschreibung', 'ZONK-Stimmen',
  'Publikumsstimmen gesamt', 'Publikumsstimmen gewertet', 'Juroren abgegeben', 'Juroren aktiv',
];

function nullableNumber(value: number | null) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(2));
}

export function buildWeekResultRows(week: ReleaseWeekStatistics) {
  const zonkBySong = new Map(week.zonk.map((row) => [row.song.id, row.count]));
  return [
    RESULT_HEADERS,
    ...week.comparisonRows.map((row) => [
      week.round.id,
      week.round.title,
      week.round.slug,
      week.round.status,
      week.round.starts_at,
      week.round.ends_at,
      row.song.id,
      row.song.title,
      row.song.artist,
      row.overallRank,
      row.total,
      row.juryPoints,
      nullableNumber(row.juryAverage),
      row.juryRank,
      row.audiencePoints,
      row.audienceRawPoints,
      row.audienceMentions,
      row.audienceRank,
      row.rankDifference,
      row.polarizationIndex,
      row.polarizationLabel,
      zonkBySong.get(row.song.id) || 0,
      week.totalVotes,
      week.countedVotes,
      week.submittedJurors,
      week.activeJurors,
    ]),
  ];
}

function weekKpiRows(week: ReleaseWeekStatistics) {
  return [
    ['Kennzahl', 'Wert', 'Erläuterung'],
    ['Songs', week.songsCount, 'Songs in dieser Umfrage'],
    ['Publikumsstimmen gesamt', week.totalVotes, 'Alle eingegangenen Publikums-Votings'],
    ['Publikumsstimmen gewertet', week.countedVotes, 'Bestätigt und aktuell gewertet'],
    ['Einzelwertungen/Nennungen', week.individualRatings, 'Publikumsnennungen plus positive Jurywertungen'],
    ['Jury abgegeben', week.submittedJurors, `von ${week.activeJurors} aktiven Juroren`],
    ['Abstand Platz 1–2', week.winnerGap, 'Gesamtpunkte'],
    ['Punkteanteil Top 3 (%)', nullableNumber(week.top3Share), 'Anteil an allen Gesamtpunkten'],
    ['Punkteanteil Top 5 (%)', nullableNumber(week.top5Share), 'Anteil an allen Gesamtpunkten'],
    ['Songs ohne Gesamtpunkte', week.songsWithoutPoints, 'Keine Jury- oder Publikumspunkte in der Gesamtwertung'],
    ['Songs ohne Nennung', week.songsWithoutRatings, 'Weder Publikum noch abgeschlossene Jury haben den Song platziert'],
    ['Ø Polarisierungsindex', nullableNumber(week.averagePolarization), '0 = Einigkeit, 100 = maximale Uneinigkeit'],
  ];
}

function highlightRows(week: ReleaseWeekStatistics) {
  return [
    ['Typ', 'Wert', 'Beschreibung'],
    ...week.highlights.map((highlight) => [highlight.title, highlight.value, highlight.detail]),
  ];
}

export function buildWeekExportSheets(week: ReleaseWeekStatistics): WorkbookSheet[] {
  return [
    { name: 'Ergebnisse', rows: buildWeekResultRows(week) },
    { name: 'Kennzahlen', rows: weekKpiRows(week) },
    { name: 'Besonderheiten', rows: highlightRows(week) },
  ];
}

function artistRows(artists: ArtistHistory[]) {
  return [
    ['Künstlerangabe', 'Teilnahmen', 'Ø Gesamtplatz', 'Beste Platzierung', 'Schlechteste Platzierung', 'Siege', 'Top 3', 'Top 5', 'Ø Publikumsplatz', 'Ø Juryplatz', 'Letzte Teilnahme'],
    ...artists.map((artist) => [
      artist.name,
      artist.participations,
      nullableNumber(artist.averageRank),
      artist.bestRank,
      artist.worstRank,
      artist.wins,
      artist.top3,
      artist.top5,
      nullableNumber(artist.averageAudienceRank),
      nullableNumber(artist.averageJuryRank),
      artist.lastParticipation,
    ]),
  ];
}

export function buildArchiveExportSheets(archive: ReleaseStatisticsArchive): WorkbookSheet[] {
  return [
    { name: 'Alle Ergebnisse', rows: [RESULT_HEADERS, ...archive.weeks.flatMap((week) => buildWeekResultRows(week).slice(1))] },
    {
      name: 'Wochenübersicht',
      rows: [
        ['Umfrage-ID', 'Umfrage', 'Status', 'Start', 'Songs', 'Publikum gesamt', 'Publikum gewertet', 'Jury abgegeben', 'Jury aktiv', 'Abstand Platz 1–2', 'Top-3-Anteil (%)', 'Top-5-Anteil (%)', 'Ø Polarisation'],
        ...archive.weeks.map((week) => [
          week.round.id, week.round.title, week.round.status, week.round.starts_at, week.songsCount,
          week.totalVotes, week.countedVotes, week.submittedJurors, week.activeJurors, week.winnerGap,
          nullableNumber(week.top3Share), nullableNumber(week.top5Share), nullableNumber(week.averagePolarization),
        ]),
      ],
    },
    { name: 'Künstlerübersicht', rows: artistRows(archive.artists) },
  ];
}
