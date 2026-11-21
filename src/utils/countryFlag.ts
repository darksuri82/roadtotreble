/**
 * Converts a 2-letter ISO country code (e.g. 'KR', 'FR', 'GB') to its Unicode flag emoji.
 */
export function getCountryFlag(code: string): string {
  if (!code || code.length !== 2) return '🏳️';
  const upper = code.toUpperCase();
  const base = 127397;
  return String.fromCodePoint(
    upper.charCodeAt(0) + base,
    upper.charCodeAt(1) + base,
  );
}
