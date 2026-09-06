import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  extractQuantity,
  extractPackSize,
  stripFillers,
  tokenize,
} from '../src/lib/voice/normalize.js';
import { matchLine, packSizeQuestion, levenshtein } from '../src/lib/voice/match.js';
import { createSession, ingest } from '../src/lib/voice/session.js';

// Mirrors backend/src/seeds — the 3-size Aachi group is the §9.2 test fixture.
const CATALOG = [
  { id: 'a50', name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', brand: 'Aachi', pack_size: '50g', variant_group: 'acm', in_stock: true },
  { id: 'a100', name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', brand: 'Aachi', pack_size: '100g', variant_group: 'acm', in_stock: true },
  { id: 'a1k', name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', brand: 'Aachi', pack_size: '1kg', variant_group: 'acm', in_stock: true },
  { id: 'milk', name: 'Aavin Milk', name_ta: 'ஆவின் பால்', brand: 'Aavin', pack_size: '500ml', variant_group: null, in_stock: true },
  { id: 'dal', name: 'Toor Dal', name_ta: 'துவரம் பருப்பு', brand: null, pack_size: '1kg', variant_group: null, in_stock: true },
  { id: 'boost', name: 'Boost', name_ta: 'பூஸ்ட்', brand: 'Boost', pack_size: '500g', variant_group: null, in_stock: false },
];

describe('normalize', () => {
  it('extracts a leading digit quantity', () => {
    expect(extractQuantity(tokenize('2 aavin milk'))).toEqual({ qty: 2, tokens: ['aavin', 'milk'] });
  });
  it('extracts a Tamil number word ("onnu" = 1)', () => {
    const { qty } = extractQuantity(tokenize('aachi chicken masala onnu'));
    expect(qty).toBe(1);
  });
  it('extracts "rendu" = 2', () => {
    expect(extractQuantity(tokenize('rendu dal')).qty).toBe(2);
  });
  it('parses a pack size ("100 gram" -> "100g")', () => {
    expect(extractPackSize(tokenize('100 gram')).size).toBe('100g');
    expect(extractPackSize(tokenize('1kg')).size).toBe('1kg');
    expect(extractPackSize(tokenize('500 ml')).size).toBe('500ml');
  });
  it('drops fillers (venum / kudu / please)', () => {
    expect(stripFillers(tokenize('aavin milk venum kudu'))).toEqual(['aavin', 'milk']);
  });
  it('levenshtein basic', () => {
    expect(levenshtein('aachi', 'archi')).toBe(1);
  });
});

describe('§9.2 variant disambiguation', () => {
  it('"aachi chicken masala onnu" (no size) -> asks, listing the 3 real sizes', () => {
    const line = matchLine('aachi chicken masala onnu', CATALOG, { lang: 'en' });
    expect(line.needs).toBe('pack_size');
    expect(line.qty).toBe(1);
    expect(line.options).toEqual(['50g', '100g', '1kg']);
  });

  it('phrases the question in the customer language', () => {
    expect(packSizeQuestion(['50g', '100g', '1kg'], 'en')).toMatch(/50g, 100g or 1kg/);
    expect(packSizeQuestion(['50g', '100g', '1kg'], 'ta')).toContain('வேணுமா');
  });

  it('size given up front -> resolves directly, no question', () => {
    const line = matchLine('aachi chicken masala 100 gram', CATALOG, { lang: 'en' });
    expect(line.needs).toBeNull();
    expect(line.matched_product_id).toBe('a100');
  });

  it('fuzzy brand ("archi") still matches "Aachi"', () => {
    const line = matchLine('archi chicken masala 1kg', CATALOG, { lang: 'en' });
    expect(line.matched_product_id).toBe('a1k');
  });
});

describe('single-size product asks nothing (§9.2)', () => {
  it('"one aavin milk" resolves straight away', () => {
    const line = matchLine('one aavin milk', CATALOG, { lang: 'en' });
    expect(line.needs).toBeNull();
    expect(line.matched_product_id).toBe('milk');
    expect(line.qty).toBe(1);
  });
});

describe('out-of-stock & no-match', () => {
  it('out-of-stock item is flagged', () => {
    expect(matchLine('boost', CATALOG, { lang: 'en' }).needs).toBe('out_of_stock');
  });
  it('unknown item -> not_found', () => {
    expect(matchLine('washing machine', CATALOG, { lang: 'en' }).needs).toBe('not_found');
  });
});

describe('§9.3 multi-turn session', () => {
  it('asks for size, then a bare "100 gram" follow-up resolves it', () => {
    const s = createSession({ shopSlug: 'X', lang: 'en' });
    const r1 = ingest(s, 'aachi chicken masala onnu', CATALOG);
    expect(r1.options).toEqual(['50g', '100g', '1kg']);
    expect(s.lines).toHaveLength(0);

    const r2 = ingest(s, '100 gram', CATALOG);
    expect(r2.resolvedLine.matched_product_id).toBe('a100');
    expect(s.lines).toHaveLength(1);
    expect(s.pending).toBeNull();
  });

  it('a non-answer after a question is treated as a fresh request', () => {
    const s = createSession({ shopSlug: 'X', lang: 'en' });
    ingest(s, 'aachi chicken masala', CATALOG); // pending pack_size
    const r = ingest(s, 'one aavin milk', CATALOG); // unrelated
    expect(r.resolvedLine.matched_product_id).toBe('milk');
    expect(s.pending).toBeNull();
  });

  it('Tamil-script order resolves to the Tamil item name in the reply', () => {
    const s = createSession({ shopSlug: 'X', lang: 'ta' });
    const r = ingest(s, 'ஆவின் பால் ஒன்று', CATALOG);
    expect(r.resolvedLine.matched_product_id).toBe('milk');
    expect(r.reply).toContain('ஆவின் பால்');
  });

  it('code-mixed "rendu toor dal venum" -> qty 2, resolved', () => {
    const s = createSession({ shopSlug: 'X', lang: 'en' });
    const r = ingest(s, 'rendu toor dal venum', CATALOG);
    expect(r.resolvedLine.matched_product_id).toBe('dal');
    expect(r.resolvedLine.qty).toBe(2);
  });
});
