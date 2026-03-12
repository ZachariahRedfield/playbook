export const canonicalizePatternId = (observation: string): string => {
  const normalized = observation.toLowerCase().replace(/[_-]+/g, ' ');

  if (/missing\s+(unit\s+)?tests?|lacks?\s+tests?|test\s+absence/.test(normalized)) {
    return 'MODULE_TEST_ABSENCE';
  }

  if (/dependency\s+cycle|circular\s+dependency/.test(normalized)) {
    return 'DEPENDENCY_CYCLE';
  }

  if (/missing\s+notes|notes\s+missing|notes\s+empty|governance\s+gap/.test(normalized)) {
    return 'GOVERNANCE_NOTES_GAP';
  }

  if (/missing\s+documentation|undocumented|docs?\s+coverage\s+gap/.test(normalized)) {
    return 'DOCUMENTATION_GAP';
  }

  const compact = normalized
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .slice(0, 6)
    .join('_')
    .toUpperCase();

  return compact.length > 0 ? compact : 'UNCLASSIFIED_PATTERN';
};
