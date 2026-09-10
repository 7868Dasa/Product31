import { describe, it, expect } from 'vitest';
import { matchLine } from '../src/lib/voice/match.js';
import { romanize, tamilSkeleton, skeletonEq, cleanUnicode } from '../src/lib/voice/translit.js';

const CATALOG = [
  { id: 'marie', name: 'Marie Biscuit', name_ta: 'மேரி பிஸ்கட்', brand: 'Britannia', pack_size: '150g', sell_by: 'pack', in_stock: true },
  { id: 'dal', name: 'Toor Dal', name_ta: 'துவரம் பருப்பு', brand: null, pack_size: '1kg', sell_by: 'pack', in_stock: true },
  { id: 'oil', name: 'Sunflower Oil', name_ta: 'சூரியகாந்தி எண்ணெய்', brand: null, sell_by: 'weight', base_unit: 'l', in_stock: true },
  { id: 'salt', name: 'Tata Salt', name_ta: 'டாடா உப்பு', brand: 'Tata', pack_size: '1kg', sell_by: 'pack', in_stock: true },
];

describe('translit helpers', () => {
  it('romanize is roughly phonetic', () => {
    expect(romanize('பிஸ்கட்')).toBe('piskat');
    expect(romanize('பருப்பு')).toBe('paruppu');
    expect(romanize('ஆவின் பால்')).toBe('aavin paal');
  });

  it('tamilSkeleton drops vowels and collapses swap classes', () => {
    // ழ/ள/ல all -> L
    expect(tamilSkeleton('வழ')).toBe(tamilSkeleton('வள'));
    // doubled consonant collapses (பிஸ்கட் ~ பிஸ்கட்டு)
    expect(skeletonEq('பிஸ்கட்டு', 'பிஸ்கட்')).toBe(true);
    // unrelated words do not collide
    expect(skeletonEq('பருப்பு', 'உப்பு')).toBe(false);
  });

  it('cleanUnicode strips zero-width joiners and BOM', () => {
    expect(cleanUnicode('a‌b﻿').length).toBe(2);
  });
});

describe('Tamil-script query -> item (cross-script, no model)', () => {
  it('"பிஸ்கட்" resolves to Marie Biscuit', () => {
    expect(matchLine('பிஸ்கட்', CATALOG, { lang: 'ta' }).matched_product_id).toBe('marie');
  });

  it('"ரெண்டு பிஸ்கட்" -> Marie Biscuit, qty 2', () => {
    const l = matchLine('ரெண்டு பிஸ்கட்', CATALOG, { lang: 'ta' });
    expect(l.matched_product_id).toBe('marie');
    expect(l.quantity).toBe(2);
  });

  it('"பருப்பு" resolves to Toor Dal', () => {
    expect(matchLine('பருப்பு', CATALOG, { lang: 'ta' }).matched_product_id).toBe('dal');
  });

  it('romanised transliteration variants "parupu" / "paruppo" -> Toor Dal', () => {
    expect(matchLine('parupu', CATALOG, { lang: 'ta' }).matched_product_id).toBe('dal');
    expect(matchLine('paruppo venum', CATALOG, { lang: 'ta' }).matched_product_id).toBe('dal');
  });

  it('"உப்பு" -> Tata Salt', () => {
    expect(matchLine('உப்பு', CATALOG, { lang: 'ta' }).matched_product_id).toBe('salt');
  });

  it('trailing zero-width joiner does not break the match', () => {
    expect(matchLine('பிஸ்கட்‌', CATALOG, { lang: 'ta' }).matched_product_id).toBe('marie');
  });
});

describe('no false positives from cross-script fuzz', () => {
  it('"டீவி" (TV — not sold here) -> not_found', () => {
    expect(matchLine('டீவி', CATALOG, { lang: 'ta' }).needs).toBe('not_found');
  });

  it('English noise "shampoo" still -> not_found', () => {
    expect(matchLine('shampoo', CATALOG, { lang: 'en' }).needs).toBe('not_found');
  });
});
