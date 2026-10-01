export function cleanArtistLabel(value: string) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function normalizeArtistKey(value: string) {
  return cleanArtistLabel(value).toLocaleLowerCase('de-DE');
}

/**
 * Zerlegt einen Song-Artist-String in einzelne Künstler.
 * Bewusst NICHT an "&" oder "und" trennen, weil diese Zeichen oft Bestandteil
 * eines festen Act-Namens sind (z. B. "2 Engel & Charlie").
 */
export function splitReleaseArtistNames(value: string) {
  const cleaned = cleanArtistLabel(value);
  if (!cleaned) return [] as string[];

  const parts = cleaned
    .split(/\s*(?:,|;|\/|\+|\s+x\s+|\s+feat\.?\s+|\s+ft\.?\s+|\s+featuring\s+)\s*/i)
    .map(cleanArtistLabel)
    .filter(Boolean);

  const unique = new Map<string, string>();
  for (const part of parts.length ? parts : [cleaned]) {
    const key = normalizeArtistKey(part);
    if (key && !unique.has(key)) unique.set(key, part);
  }
  return Array.from(unique.values());
}

export function hasReleaseArtistCollaboration(value: string) {
  return splitReleaseArtistNames(value).length > 1;
}
