/**
 * Layer 1 — phonetic keys (Double Metaphone). Free, offline, ~2 KB.
 *
 * Catches ASR mis-spellings and typos that are edit-distance-far but
 * sound alike:  "chickween" ≡ "chicken" (XKN),  "aachy" ≡ "aachi" (AX).
 * Real noise still fails:  "briyani" (PRN) ≠ "chicken" (XKN).
 *
 * Latin script only — Tamil-script tokens fall back to edit distance
 * against `name_ta`, which already works.
 */
import { doubleMetaphone } from 'double-metaphone';

export function phoneticKey(token) {
  if (!token || !/[a-z]/i.test(token) || token.length < 3) return null;
  try {
    const [primary] = doubleMetaphone(token);
    return primary || null;
  } catch {
    return null;
  }
}

/** Do two tokens sound the same (or one is a phonetic prefix of the other)? */
export function phoneticEq(a, b) {
  const ka = phoneticKey(a);
  const kb = phoneticKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // "chickween"→XKWN vs "chicken"→XKN style near-misses
  return ka.length >= 3 && kb.length >= 3 && (ka.startsWith(kb) || kb.startsWith(ka));
}
