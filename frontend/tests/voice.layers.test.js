import { describe, it, expect } from 'vitest';
import { phoneticKey, phoneticEq } from '../src/lib/voice/phonetics.js';
import { applySynonyms } from '../src/lib/voice/synonyms.js';
import { matchLine } from '../src/lib/voice/match.js';
import { createSession, ingest } from '../src/lib/voice/session.js';

const CATALOG = [
  { id: 'a50', name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', brand: 'Aachi', pack_size: '50g', variant_group: 'acm', sell_by: 'pack', in_stock: true },
  { id: 'a100', name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', brand: 'Aachi', pack_size: '100g', variant_group: 'acm', sell_by: 'pack', in_stock: true },
  { id: 'milk', name: 'Aavin Milk', name_ta: 'ஆவின் பால்', brand: 'Aavin', pack_size: '500ml', sell_by: 'pack', in_stock: true },
  { id: 'dal', name: 'Toor Dal', name_ta: 'துவரம் பருப்பு', sell_by: 'weight', base_unit: 'kg', price_basis: 'per_kg', min_qty: 0.25, max_qty: 10, step_qty: 0.25, in_stock: true },
  { id: 'oil', name: 'Sunflower Oil', name_ta: 'சூரியகாந்தி எண்ணெய்', sell_by: 'weight', base_unit: 'l', price_basis: 'per_l', min_qty: 0.25, max_qty: 5, step_qty: 0.25, in_stock: true },
  { id: 'coco', name: 'Coconut', name_ta: 'தேங்காய்', sell_by: 'piece', base_unit: 'pcs', price_basis: 'per_piece', in_stock: true },
];

describe('Layer 1 — phonetics', () => {
  it('sound-alikes share a key', () => {
    expect(phoneticKey('chicken')).toBe(phoneticKey('chickween'));
    expect(phoneticEq('aachy', 'aachi')).toBe(true);
    expect(phoneticEq('biskoot', 'biscuit')).toBe(true);
  });
  it('real noise does not', () => {
    expect(phoneticEq('briyani', 'chicken')).toBe(false);
    expect(phoneticEq('parle', 'marie')).toBe(false);
  });
  it('"aachy chikken masala 100g" resolves via phonetics', () => {
    expect(matchLine('aachy chikken masala 100g', CATALOG, { lang: 'en' }).matched_product_id).toBe('a100');
  });
  it('Tamil-script query is unaffected (falls back to edit distance)', () => {
    expect(matchLine('ஆவின் பால் ஒன்று', CATALOG, { lang: 'ta' }).matched_product_id).toBe('milk');
  });
});

describe('Layer 2 — synonyms', () => {
  it('rewrites Tamil / common names to canonical tokens', () => {
    expect(applySynonyms('arai kilo paruppu')).toBe('arai kilo toor dal');
    expect(applySynonyms('oru paal')).toBe('oru milk');
    expect(applySynonyms('thengai moonu')).toBe('coconut moonu');
    expect(applySynonyms('konjam ennai')).toBe('konjam sunflower oil');
  });
  it('leaves unknown text alone', () => {
    expect(applySynonyms('two aavin milk')).toBe('two aavin milk');
  });
  it('"arai kilo paruppu" → Toor Dal, 0.5 kg', () => {
    const l = matchLine('arai kilo paruppu', CATALOG, { lang: 'ta' });
    expect(l.matched_product_id).toBe('dal');
    expect(l.quantity).toBe(0.5);
  });
  it('"rendu paal" → 2 × Aavin Milk', () => {
    const l = matchLine('rendu paal', CATALOG, { lang: 'ta' });
    expect(l.matched_product_id).toBe('milk');
    expect(l.quantity).toBe(2);
  });
  it('"moonu thengai" → 3 × Coconut', () => {
    const l = matchLine('moonu thengai', CATALOG, { lang: 'ta' });
    expect(l.matched_product_id).toBe('coco');
    expect(l.quantity).toBe(3);
  });
});

describe('guard still holds after layers 1-2', () => {
  it('"briyani masala" → not_found', () => {
    expect(matchLine('briyani masala', CATALOG, { lang: 'en' }).needs).toBe('not_found');
  });
  it('"washing powder" → not_found', () => {
    expect(matchLine('washing powder', CATALOG, { lang: 'en' }).needs).toBe('not_found');
  });
});

describe('miss logging', () => {
  it('session returns unmatched segments for the miss log', () => {
    const s = createSession({ shopSlug: 'X', lang: 'en' });
    const r = ingest(s, 'two milk and washing machine', CATALOG);
    expect(r.unmatched).toContain('washing machine');
    expect(s.lines).toHaveLength(1); // milk still added
  });
});
