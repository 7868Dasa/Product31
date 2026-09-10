/**
 * Layer 1 — Tamil transliteration + a "loose key" for fuzzy matching.
 * Free, offline, deterministic, ~1 KB. No model, no network.
 *
 * Two jobs:
 *   romanize(s)   — rough Tamil -> Latin so a Tamil-script utterance can be
 *                   compared to an English `name` (and fed to double-metaphone).
 *                   Not scholarly ISO 15919 — tuned for grocery matching.
 *   tamilSkeleton(s) — collapses the consonant classes Tamil speakers and ASR
 *                   engines routinely swap (zha/La/la, Na/na/na, Ra/ra,
 *                   tha/ta, sa/sha) and drops vowels, so a word and its
 *                   mis-heard variants reduce to the same skeleton.
 *
 * Both are SUPPLEMENTARY signals — they can boost a match, never carry it
 * alone (the generic-token guard in match.js still decides).
 */

const TAMIL_RANGE = /[஀-௿]/;
const ZERO_WIDTH = /[​-‍﻿]/g;

export function hasTamil(s) {
  return TAMIL_RANGE.test(String(s || ''));
}

/** NFC + strip zero-width joiners / BOM that break equality on identical-looking text. */
export function cleanUnicode(s) {
  return String(s || '').normalize('NFC').replace(ZERO_WIDTH, '');
}

// Independent vowels + vowel signs -> latin.
const VOWEL = {
  'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee',
  'உ': 'u', 'ஊ': 'oo', 'எ': 'e', 'ஏ': 'e',
  'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'au',
  'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u',
  'ூ': 'oo', 'ெ': 'e', 'ே': 'e', 'ை': 'ai',
  'ொ': 'o', 'ோ': 'o', 'ௌ': 'au',
};
const PULLI = '்'; // virama — suppresses the inherent 'a'
const AYTHAM = 'ஃ';

// Consonant -> latin (grocery-fuzzy, not phonemic).
const CONS = {
  'க': 'k', 'ங': 'ng', 'ச': 's', 'ஜ': 'j', 'ஞ': 'ny',
  'ட': 't', 'ண': 'n', 'த': 'th', 'ந': 'n', 'ன': 'n',
  'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r', 'ற': 'r',
  'ல': 'l', 'ள': 'l', 'ழ': 'l', 'வ': 'v', 'ஶ': 'sh',
  'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h',
};

export function romanize(input) {
  const s = cleanUnicode(input);
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (VOWEL[ch] !== undefined) {
      out += VOWEL[ch];
      continue;
    }
    if (CONS[ch] !== undefined) {
      const next = s[i + 1];
      if (next === PULLI) {
        out += CONS[ch];
        i += 1; // consume the pulli, no inherent vowel
      } else if (VOWEL[next] !== undefined) {
        out += CONS[ch] + VOWEL[next];
        i += 1;
      } else {
        out += CONS[ch] + 'a'; // inherent vowel
      }
      continue;
    }
    if (ch === AYTHAM) {
      out += 'h';
      continue;
    }
    if (ch === PULLI) continue;
    out += ch; // Latin / digits / spaces pass straight through
  }
  return out.toLowerCase();
}

// Consonant classes that Tamil speakers + ASR swap. Latin letters map too, so
// a romanised token and a native token collapse to the same skeleton.
const CLASS = {
  'ண': 'N', 'ந': 'N', 'ன': 'N', n: 'N',
  'ர': 'R', 'ற': 'R', r: 'R',
  'ல': 'L', 'ள': 'L', 'ழ': 'L', l: 'L',
  'ட': 'T', 'த': 'T', t: 'T', d: 'T',
  'ச': 'S', 'ஶ': 'S', 'ஷ': 'S', 'ஸ': 'S', s: 'S', c: 'S',
  'க': 'K', 'ங': 'K', k: 'K', g: 'K', q: 'K',
  'ப': 'P', p: 'P', b: 'P', f: 'P',
  'ம': 'M', m: 'M',
  'வ': 'V', v: 'V', w: 'V',
  'ய': 'Y', y: 'Y',
  'ஜ': 'J', j: 'J', 'ஞ': 'N', 'ஹ': 'H', h: 'H',
};

/** Vowel-free, class-collapsed skeleton. Runs on Tamil script OR Latin. */
export function tamilSkeleton(input) {
  const s = cleanUnicode(input).toLowerCase();
  let out = '';
  for (const ch of s) {
    const c = CLASS[ch];
    if (c && out[out.length - 1] !== c) out += c; // collapse doubled consonants
  }
  return out;
}

/** True if two strings share a Tamil consonant skeleton (>= 2 classes). */
export function skeletonEq(a, b) {
  const sa = tamilSkeleton(a);
  return sa.length >= 2 && sa === tamilSkeleton(b);
}
