/**
 * Rule-based catalog matcher (spec §9.4 layer 1). No API key. Deterministic.
 * Produces the canonical order-draft line; the optional LLM layer (§9.4.2)
 * must produce the same shape and fall back here on any error.
 *
 * A line carries how the shop sells the item (migration 0005):
 *   sell_by 'pack'   → quantity is a count, unit 'pack'   (may need pack_size)
 *   sell_by 'weight' → quantity is a numeric amount in base_unit (kg / l)
 *                      (needs 'quantity' when no weight was said)
 *   sell_by 'piece'  → quantity is a count, unit 'pcs'
 */
import {
  tokenize,
  extractAmount,
  extractPackSize,
  stripFillers,
  normalizePackSize,
  toBaseUnit,
} from './normalize.js';

// ── fuzzy string similarity ────────────────────────────────────────────
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

function bestTokenHit(token, haystackTokens) {
  let best = 0;
  for (const h of haystackTokens) {
    const s = similarity(token, h);
    if (s > best) best = s;
    if (best === 1) break;
  }
  return best;
}

function itemSearchTokens(item) {
  return [
    ...tokenize(item.name || ''),
    ...tokenize(item.name_ta || ''),
    ...tokenize(item.brand || ''),
  ];
}

export function scoreItem(queryTokens, item) {
  if (!queryTokens.length) return 0;
  const hay = itemSearchTokens(item);
  if (!hay.length) return 0;

  const hits = queryTokens.map((qt) => bestTokenHit(qt, hay));
  const overlap = hits.reduce((a, h) => a + (h >= 0.8 ? 1 : h * 0.5), 0) / queryTokens.length;

  const q = queryTokens.join(' ');
  const whole = Math.max(similarity(q, (item.name || '').toLowerCase()), similarity(q, item.name_ta || ''));

  let score = Math.max(overlap, whole * 0.9);

  // Guard against matches carried by one generic shared word
  // ("briyani masala" ~ "... masala", "parle g biscuit" ~ "marie biscuit").
  if (queryTokens.length > 1) {
    const strongFraction = hits.filter((h) => h >= 0.8).length / queryTokens.length;
    if (strongFraction < 0.6) score *= 0.35;
  }
  return score;
}

const MATCH_THRESHOLD = 0.55;

export function rankCandidates(queryTokens, catalog) {
  return catalog
    .map((item) => ({ item, score: scoreItem(queryTokens, item) }))
    .filter((c) => c.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

// ── clarification questions (spec §9.2) ───────────────────────────────
export function packSizeQuestion(options, lang) {
  if (lang === 'ta') {
    const parts = options.map((s) => `${s} வேணுமா`);
    const last = parts.pop();
    return `${parts.join(', ')}${parts.length ? ', இல்லை ' : ''}${last}?`;
  }
  const last = options[options.length - 1];
  const head = options.slice(0, -1).join(', ');
  return options.length > 1 ? `Which size — ${head} or ${last}?` : `Size ${last}?`;
}

function fmtQty(v, base) {
  if (base === 'kg') return v < 1 ? `${Math.round(v * 1000)} g` : `${Number(v.toFixed(2))} kg`;
  if (base === 'l') return v < 1 ? `${Math.round(v * 1000)} ml` : `${Number(v.toFixed(2))} l`;
  return `${v}`;
}

export function weightOptions(item) {
  const base = item.base_unit || 'kg';
  const step = item.step_qty || 0.25;
  const max = item.max_qty || 10;
  const min = item.min_qty || step;
  const picks = [min, step * 2, step * 4, step * 8].filter((v) => v >= min && v <= max);
  return [...new Set(picks)].slice(0, 4).map((v) => fmtQty(v, base));
}

export function quantityQuestion(item, lang) {
  const opts = weightOptions(item).join(', ');
  return lang === 'ta' ? `எவ்வளவு வேணும்? (${opts})` : `How much? (${opts})`;
}

function clampSnap(qty, item) {
  const step = item.step_qty || 0;
  const min = item.min_qty || step || 0;
  const max = item.max_qty || Infinity;
  let q = step ? Math.round(qty / step) * step : qty;
  q = Math.min(Math.max(q, min || q), max);
  return Math.round(q * 1000) / 1000;
}

// ── line builder ─────────────────────────────────────────────────────
function sellByOf(item) {
  return item.sell_by || item.default_sell_by || 'pack';
}
function basisOf(item) {
  const s = sellByOf(item);
  return item.price_basis || (s === 'weight' ? 'per_kg' : s === 'piece' ? 'per_piece' : 'per_pack');
}

function lineFor(item, query, { quantity, unit }) {
  const sellBy = sellByOf(item);
  return {
    query,
    matched_product_id: item.id,
    pack_size: item.pack_size ?? null,
    sell_by: sellBy,
    price_basis: basisOf(item),
    quantity,
    unit,
    qty: quantity, // back-compat alias
    needs: item.in_stock ? null : 'out_of_stock',
  };
}

function clarify(needs, query, count, extra = {}) {
  return {
    query,
    matched_product_id: null,
    pack_size: null,
    sell_by: null,
    quantity: count ?? 1,
    unit: null,
    qty: count ?? 1,
    needs,
    ...extra,
  };
}

// ── the matcher ──────────────────────────────────────────────────────
/**
 * @returns line: { query, quantity, unit, sell_by, price_basis, matched_product_id,
 *                  pack_size, needs, options?, qty }
 *   needs ∈ null | 'pack_size' | 'quantity' | 'not_found' | 'out_of_stock'
 */
export function matchLine(transcript, catalog, { lang = 'en' } = {}) {
  const raw = tokenize(transcript);
  const { count, weight, tokens: afterAmount } = extractAmount(raw);
  const queryTokens = stripFillers(afterAmount);
  const query = queryTokens.join(' ');

  const ranked = rankCandidates(queryTokens, catalog);
  if (!ranked.length) return clarify('not_found', query, count);

  const top = ranked[0].item;
  const sellBy = sellByOf(top);

  // ── weight: quantity is a numeric amount ────────────────────────────
  if (sellBy === 'weight') {
    if (weight) {
      const base = top.base_unit || 'kg';
      const q = clampSnap(toBaseUnit(weight, base), top);
      return lineFor(top, query, { quantity: q, unit: base });
    }
    // a bare number as an amount for a per-kg item → that many kg/l
    if (count != null) {
      const base = top.base_unit || 'kg';
      return lineFor(top, query, { quantity: clampSnap(count, top), unit: base });
    }
    return clarify('quantity', query, count, {
      matched_product_id: top.id,
      options: weightOptions(top),
      _item: top,
    });
  }

  // ── piece: quantity is a count ─────────────────────────────────────
  if (sellBy === 'piece') {
    return lineFor(top, query, { quantity: count ?? 1, unit: 'pcs' });
  }

  // ── pack: existing variant-group disambiguation ────────────────────
  const spokenSize = weight ? `${weight.value}${weight.unit}` : null;
  const siblings = top.variant_group
    ? catalog.filter((c) => c.variant_group === top.variant_group)
    : catalog.filter((c) => (c.name || '').toLowerCase() === (top.name || '').toLowerCase());
  const inStockSiblings = siblings.filter((c) => c.in_stock);

  if (spokenSize) {
    const hit = siblings.find((c) => normalizePackSize(c.pack_size) === normalizePackSize(spokenSize));
    if (hit) return lineFor(hit, query, { quantity: count ?? 1, unit: 'pack' });
    return clarify('pack_size', query, count, {
      options: uniquePackSizes(inStockSiblings.length ? inStockSiblings : siblings),
    });
  }

  const distinctSizes = uniquePackSizes(inStockSiblings.length ? inStockSiblings : siblings);
  if (distinctSizes.length > 1) {
    return clarify('pack_size', query, count, { options: distinctSizes });
  }

  return lineFor(top, query, { quantity: count ?? 1, unit: 'pack' });
}

function uniquePackSizes(items) {
  const seen = [];
  for (const it of items) {
    if (it.pack_size && !seen.includes(it.pack_size)) seen.push(it.pack_size);
  }
  return seen;
}

/** Resolve a pending pack-size question against a short follow-up utterance. */
export function resolvePackSizeAnswer(answer, options, catalog, baseLine) {
  const { size } = extractPackSize(tokenize(answer));
  const norm = size || tokenize(answer).map((t) => normalizePackSize(t)).find(Boolean);
  if (!norm) return null;
  const chosen = options.find((o) => normalizePackSize(o) === normalizePackSize(norm));
  if (!chosen) return null;
  const item = catalog.find(
    (c) =>
      normalizePackSize(c.pack_size) === normalizePackSize(chosen) &&
      (baseLine?.query ? scoreItem(tokenize(baseLine.query), c) >= 0.4 : true),
  );
  if (!item) return null;
  return lineFor(item, baseLine?.query || item.name, { quantity: baseLine?.quantity ?? 1, unit: 'pack' });
}

/** Resolve a pending "how much?" question for a weight item. */
export function resolveQuantityAnswer(answer, item, baseLine) {
  if (!item) return null;
  const { weight, count } = extractAmount(tokenize(answer));
  const base = item.base_unit || 'kg';
  let qty = null;
  if (weight) qty = toBaseUnit(weight, base);
  else if (count != null) qty = count; // "2" -> 2 kg
  if (qty == null || qty <= 0) return null;
  return lineFor(item, baseLine?.query || item.name, { quantity: clampSnap(qty, item), unit: base });
}

export function buildEnvelope(lines, transcript, { shop_slug, lang }) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const worst = arr.some((l) => l.needs === 'not_found')
    ? 0.2
    : arr.some((l) => l.needs)
      ? 0.6
      : 0.85;
  return { type: 'order_draft', shop_slug, lang, transcript, lines: arr, confidence: worst };
}
