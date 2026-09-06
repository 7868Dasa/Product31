/**
 * Split one utterance into item segments so a shopper can say their whole
 * list at once: "rendu milk, oru rice, arai kilo dal".
 *
 * Conservative on purpose — over-splitting turns one item into two failed
 * matches. We only split on explicit connectives / commas, never on a bare
 * space.
 */
import { tokenize } from './normalize.js';

// connective tokens that separate items (both scripts)
const CONNECTIVES = new Set([
  'and', 'also', 'plus',
  'um', 'kooda', 'kuda', 'appuram', 'apram', 'pinne', 'apparam', 'melum',
  'மற்றும்', 'கூட', 'அப்புறம்', 'அப்பரம்', 'பின்னே', 'மேலும்',
]);

/**
 * @param {string} transcript
 * @returns {string[]} one or more trimmed segments (always length >= 1)
 */
export function segmentUtterance(transcript) {
  const raw = String(transcript || '').trim();
  if (!raw) return [];

  // split on commas / semicolons / the word "and" (with spaces) first
  const commaParts = raw
    .split(/\s*[,;]\s*|\s+\band\b\s+|\s+\bமற்றும்\b\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const out = [];
  for (const part of commaParts) {
    const toks = tokenize(part);
    let cur = [];
    for (const tk of toks) {
      if (CONNECTIVES.has(tk)) {
        if (cur.length) out.push(cur.join(' '));
        cur = [];
      } else {
        cur.push(tk);
      }
    }
    if (cur.length) out.push(cur.join(' '));
  }

  // guard: if splitting produced a fragment with no content word (all
  // fillers/numbers), fold it back into the previous segment.
  const merged = [];
  for (const seg of out) {
    const hasWord = tokenize(seg).some((t) => t.length > 2 && !/^\d/.test(t));
    if (!hasWord && merged.length) merged[merged.length - 1] += ` ${seg}`;
    else merged.push(seg);
  }

  return merged.length ? merged : [raw];
}
