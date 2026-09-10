/**
 * Text normalisation for the voice matcher (spec §9.1). Handles code-mixed
 * Tamil + English, Tamil script and romanised, quantity words + fractions +
 * weights, and a filler/stopword list meant to grow from real usage.
 */
import { cleanUnicode } from './translit.js';

// Count-unit words a shopper says alongside a number for pack / piece items
// ("3 packet biscuit", "moonu packet biscuit", "2 pieces coconut"). They are
// noise for the product match — the number is already taken by extractAmount,
// so drop the unit word too or it pollutes the query and breaks the match.
export const COUNT_UNITS = new Set([
  'packet', 'packets', 'pack', 'packs', 'pkt', 'pkts', 'sachet', 'sachets',
  'piece', 'pieces', 'pcs', 'pc', 'nos', 'no',
  'பாக்கெட்', 'பாக்கெட்டு', 'பாக்கட்', 'பாக்கெட்ஸ்', 'துண்டு', 'துண்டுகள்',
]);

// Fillers / politeness / connectives to drop before matching. Both scripts.
export const FILLERS = new Set([
  // english
  'i', 'me', 'a', 'an', 'the', 'some', 'of', 'please', 'want', 'need', 'give',
  'get', 'gimme', 'gonna', 'like', 'and', 'also', 'add', 'to', 'my', 'for',
  // romanised tamil
  'venum', 'venunga', 'vennum', 'kudu', 'kududa', 'kudunga', 'tha',
  'tharu', 'tharunga', 'oru', 'konjam', 'illa', 'illai', 'seri',
  'appuram', 'pinne', 'innoru', 'innum',
  // tamil script
  'வேண்டும்', 'வேணும்', 'வேணுங்க', 'கொடு', 'கொடுங்க', 'தா', 'தாருங்க',
  'ஒரு', 'கொஞ்சம்', 'இல்லை', 'சரி', 'அப்புறம்', 'பின்னே', 'இன்னொரு', 'இன்னும்',
  'எனக்கு',
  // count-unit words (see COUNT_UNITS)
  ...COUNT_UNITS,
]);

// Whole number words → integer. Romanised + Tamil script.
export const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  onnu: 1, oru: 1, ondru: 1, rendu: 2, irandu: 2, moonu: 3, moondru: 3, naalu: 4,
  naangu: 4, anju: 5, aindhu: 5, aaru: 6, ezhu: 7, ettu: 8, onbadhu: 9, pathu: 10,
  ஒன்று: 1, ஒரு: 1, இரண்டு: 2, ரெண்டு: 2, மூன்று: 3, மூணு: 3, நான்கு: 4, நாலு: 4,
  ஐந்து: 5, அஞ்சு: 5, ஆறு: 6, ஏழு: 7, எட்டு: 8, ஒன்பது: 9, பத்து: 10,
};

// Standalone fraction words → decimal.
export const FRACTION_WORDS = {
  half: 0.5, quarter: 0.25, 'three-quarter': 0.75,
  arai: 0.5, kaal: 0.25, mukkaal: 0.75, mukkal: 0.75,
  அரை: 0.5, கால்: 0.25, முக்கால்: 0.75,
};

// Fused "one-and-a-half" style number words (Tamil).
export const FUSED_NUMBER_WORDS = {
  onnarai: 1.5, onnare: 1.5, rendarai: 2.5, moonarai: 3.5, naalarai: 4.5,
  onnukaal: 1.25, rendukaal: 2.25,
  ஒன்றரை: 1.5, ஒன்னரை: 1.5, ரெண்டரை: 2.5, மூணரை: 3.5,
};

// Pack-size / weight unit tokens → canonical.
const UNIT_ALIASES = {
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', கிராம்: 'g', gramme: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilogrammes: 'kg', கிலோ: 'kg', கிலோகிராம்: 'kg',
  ml: 'ml', மிலி: 'ml', millilitre: 'ml',
  l: 'l', ltr: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l', லிட்டர்: 'l',
  packet: 'pkt', pack: 'pkt', pkt: 'pkt', பாக்கெட்: 'pkt',
};
const WEIGHT_UNITS = new Set(['g', 'kg', 'ml', 'l']);

export function normalizeText(input) {
  return cleanUnicode(input)
    .toLowerCase()
    .replace(/[.,!?;:()"'`]/g, ' ')
    .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2') // keep "2 . 5" -> "2.5"
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(input) {
  // keep a decimal point inside numbers
  return cleanUnicode(input)
    .toLowerCase()
    .replace(/[,!?;:()"'`]/g, ' ')
    .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2')
    .replace(/\./g, (m, i, s) => (/\d/.test(s[i - 1] || '') && /\d/.test(s[i + 1] || '') ? '.' : ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function unitOf(tk) {
  return UNIT_ALIASES[tk] || null;
}

/**
 * Extract an amount from tokens.
 * @returns {{ count:number, weight:{value:number,unit:string}|null, tokens:string[] }}
 *   count  — a bare quantity (default 1) for pack / piece items
 *   weight — a number + weight/volume unit for loose items, or null
 */
export function extractAmount(tokens) {
  const rest = [];
  let count = null;
  let weight = null;

  const numFromToken = (tk) => {
    if (/^\d+(\.\d+)?$/.test(tk)) return Number(tk);
    if (NUMBER_WORDS[tk] != null) return NUMBER_WORDS[tk];
    if (FUSED_NUMBER_WORDS[tk] != null) return FUSED_NUMBER_WORDS[tk];
    if (FRACTION_WORDS[tk] != null) return FRACTION_WORDS[tk];
    return null;
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const tk = tokens[i];

    // glued: "500g", "2kg", "1.5l"
    const glued = tk.match(/^(\d+(?:\.\d+)?)(g|gm|gms|gram|grams|kg|kgs|kilo|kilos|kilogram|ml|l|ltr|litre|liter|liters)$/);
    if (!weight && glued) {
      weight = { value: Number(glued[1]), unit: UNIT_ALIASES[glued[2]] };
      continue;
    }

    const n = numFromToken(tk);
    const nextUnit = unitOf(tokens[i + 1]);

    // "<number> <unit>"  or  "<number> and half <unit>"
    if (!weight && n != null && nextUnit && WEIGHT_UNITS.has(nextUnit)) {
      weight = { value: n, unit: nextUnit };
      i += 1;
      continue;
    }
    // "<number> and half kg" / "onnu kaal kilo"
    if (!weight && n != null && FRACTION_WORDS[tokens[i + 1]] != null && WEIGHT_UNITS.has(unitOf(tokens[i + 2]) || '')) {
      weight = { value: n + FRACTION_WORDS[tokens[i + 1]], unit: unitOf(tokens[i + 2]) };
      i += 2;
      continue;
    }
    // fused word alone before a unit: "onnarai kilo"
    if (!weight && FUSED_NUMBER_WORDS[tk] != null && nextUnit && WEIGHT_UNITS.has(nextUnit)) {
      weight = { value: FUSED_NUMBER_WORDS[tk], unit: nextUnit };
      i += 1;
      continue;
    }
    // bare fraction before a unit: "half kg", "arai kilo"
    if (!weight && FRACTION_WORDS[tk] != null && nextUnit && WEIGHT_UNITS.has(nextUnit)) {
      weight = { value: FRACTION_WORDS[tk], unit: nextUnit };
      i += 1;
      continue;
    }
    // bare whole number → a count
    if (count == null && n != null && Number.isInteger(n) && FRACTION_WORDS[tk] == null) {
      count = n;
      continue;
    }

    rest.push(tk);
  }

  return { count, weight, tokens: rest }; // count is null when no number was said
}

// ── back-compat wrappers (existing call sites / tests) ─────────────────
export function extractQuantity(tokens) {
  const { count, tokens: rest } = extractAmount(tokens);
  return { qty: count ?? 1, tokens: rest };
}

export function extractPackSize(tokens) {
  const { weight, tokens: rest } = extractAmount(tokens);
  return { size: weight ? `${weight.value}${weight.unit}` : null, tokens: rest };
}

export function stripFillers(tokens) {
  return tokens.filter((tk) => !FILLERS.has(tk));
}

/** Normalise a catalog pack_size ("100 g", "1 KG") to the compact form ("100g"). */
export function normalizePackSize(s) {
  if (!s) return null;
  const m = String(s)
    .toLowerCase()
    .replace(/\s+/g, '')
    .match(/^(\d+(?:\.\d+)?)(g|gm|gram|kg|kilo|ml|l|ltr|litre|liter|pkt|packet)?$/);
  if (!m) return String(s).toLowerCase().replace(/\s+/g, '');
  return `${m[1]}${UNIT_ALIASES[m[2]] || m[2] || ''}`;
}

/** Convert a weight to a shop's base unit (kg or l). g→kg, ml→l. */
export function toBaseUnit(weight, baseUnit) {
  if (!weight) return null;
  const { value, unit } = weight;
  if (baseUnit === 'kg') return unit === 'g' ? value / 1000 : value; // kg or g
  if (baseUnit === 'l') return unit === 'ml' ? value / 1000 : value; // l or ml
  return value;
}
