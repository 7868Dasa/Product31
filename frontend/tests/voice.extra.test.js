import { describe, it, expect } from 'vitest';
import { matchLine, scoreItem } from '../src/lib/voice/match.js';
import { tokenize } from '../src/lib/voice/normalize.js';

const CATALOG = [
  { id: 'a100', name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', brand: 'Aachi', pack_size: '100g', variant_group: 'acm', in_stock: true },
  { id: 'a50', name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', brand: 'Aachi', pack_size: '50g', variant_group: 'acm', in_stock: true },
  { id: 'marie', name: 'Marie Biscuit', name_ta: 'மேரி பிஸ்கட்', brand: 'Britannia', pack_size: '150g', variant_group: null, in_stock: true },
  { id: 'salt', name: 'Tata Salt', name_ta: 'டாடா உப்பு', brand: 'Tata', pack_size: '1kg', variant_group: null, in_stock: true },
  { id: 'dal', name: 'Toor Dal', name_ta: 'துவரம் பருப்பு', brand: null, pack_size: '1kg', variant_group: null, in_stock: true },
];

describe('generic-token false positives (§9.6) — "if not available, say no"', () => {
  it('"briyani masala" -> not_found (not Aachi Chicken Masala)', () => {
    expect(matchLine('briyani masala', CATALOG, { lang: 'en' }).needs).toBe('not_found');
  });

  it('"parle g biscuit" -> not_found (not Marie Biscuit)', () => {
    expect(matchLine('parle g biscuit', CATALOG, { lang: 'en' }).needs).toBe('not_found');
  });

  it('"washing powder" -> not_found', () => {
    expect(matchLine('washing powder', CATALOG, { lang: 'en' }).needs).toBe('not_found');
  });

  it('typo / mis-hear "chickween masala" still matches Aachi Chicken Masala', () => {
    const line = matchLine('chickween masala', CATALOG, { lang: 'en' });
    expect(line.needs).not.toBe('not_found');
  });

  it('"chiken masala 100g" (missing letter) resolves', () => {
    expect(matchLine('chiken masala 100g', CATALOG, { lang: 'en' }).matched_product_id).toBe('a100');
  });
});

describe('real items still match', () => {
  it('"chicken masala 100g" -> resolves', () => {
    expect(matchLine('chicken masala 100g', CATALOG, { lang: 'en' }).matched_product_id).toBe('a100');
  });
  it('"marie biscuit" -> resolves', () => {
    expect(matchLine('marie biscuit', CATALOG, { lang: 'en' }).matched_product_id).toBe('marie');
  });
  it('single distinctive word "dal" -> resolves', () => {
    expect(matchLine('dal', CATALOG, { lang: 'en' }).matched_product_id).toBe('dal');
  });
  it('fuzzy "archi chicken masala 50g" -> resolves', () => {
    expect(matchLine('archi chicken masala 50g', CATALOG, { lang: 'en' }).matched_product_id).toBe('a50');
  });
});

describe('scoreItem guard', () => {
  it('generic shared-word match scores below threshold', () => {
    expect(scoreItem(tokenize('briyani masala'), CATALOG[0])).toBeLessThan(0.55);
    expect(scoreItem(tokenize('parle g biscuit'), CATALOG[2])).toBeLessThan(0.55);
  });
});
