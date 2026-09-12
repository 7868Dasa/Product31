/**
 * Layer 1 — phonetic keys (Double Metaphone). Free, offline, ~2 KB.
 *
 * Catches ASR mis-spellings and typos that are edit-distance-far but
 * sound alike:  "chickween" ≡ "chicken" (XKN),  "aachy" ≡ "aachi" (AX).
 * Real noise still fails:  "briyani" (PRN) ≠ "chicken" (XKN).
 *
 * Tamil-script tokens are romanised first (translit.js), so "பிஸ்கட்"
 * ("piskat") lands near "biscuit" phonetically instead of only via edit
 * distance against `name_ta`.
 */
import { doubleMetaphone } from 'double-metaphone';
import { hasTamil, romanize, skeletonEq, tamilSkeleton } from './translit.js';
import { similarity } from './textDistance.js';

export function phoneticKey(token) {
  if (!token) return null;
  const t = hasTamil(token) ? romanize(token) : token;
  if (!/[a-z]/i.test(t) || t.length < 3) return null;
  try {
    const [primary] = doubleMetaphone(t);
    return primary || null;
  } catch {
    return null;
  }
}

/** Do two tokens sound the same (or one is a phonetic prefix of the other)? */
export function phoneticEq(a, b) {
  // Tamil consonant-class skeleton — catches ழ/ள/ல, ண/ன/ந, ற/ர swaps that
  // metaphone (Latin-trained) misses. A skeleton of just 2 classes (e.g.
  // "PL") is short enough that unrelated words collide by coincidence
  // (பால் "milk" and "apple" both collapse to "PL"), so a 2-class match is
  // only trusted once the romanised forms are also close — real swaps like
  // பால்/பாள் romanise identically ("paal"), coincidences don't. A 3+ class
  // skeleton is specific enough to stand on its own.
  if ((hasTamil(a) || hasTamil(b)) && skeletonEq(a, b)) {
    if (tamilSkeleton(a).length >= 3) return true;
    const ra = hasTamil(a) ? romanize(a) : a;
    const rb = hasTamil(b) ? romanize(b) : b;
    return similarity(ra, rb) >= 0.5;
  }
  const ka = phoneticKey(a);
  const kb = phoneticKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // "chickween"→XKWN vs "chicken"→XKN style near-misses
  return ka.length >= 3 && kb.length >= 3 && (ka.startsWith(kb) || kb.startsWith(ka));
}
