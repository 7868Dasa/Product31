/**
 * Plain Levenshtein edit-distance + a 0..1 similarity score. No deps.
 * Pulled out of match.js so phonetics.js can use it too without match.js
 * and phonetics.js importing each other (match.js already imports
 * phoneticEq from phonetics.js).
 */
export function levenshtein(a, b) {
  a = String(a);
  b = String(b);
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
}

export function similarity(a, b) {
  a = String(a).toLowerCase();
  b = String(b).toLowerCase();
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - levenshtein(a, b) / maxLen;
}
