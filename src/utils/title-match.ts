// Strip punctuation, common articles, and extra whitespace so that
// "Mission: Impossible – Dead Reckoning" matches "mission impossible dead reckoning"
// and "Spider-Man" matches "Spider Man".
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[:\-–—!?.,''""/\\()\[\]]/g, ' ')  // punctuation → space
    .replace(/\b(the|a|an)\b/g, ' ')              // drop articles
    .replace(/\s+/g, ' ')                          // collapse whitespace
    .trim();
}

export function titleMatches(found: string, wanted: string): boolean {
  const f = normalizeTitle(found);
  const w = normalizeTitle(wanted);
  return f.includes(w) || w.includes(f);
}
