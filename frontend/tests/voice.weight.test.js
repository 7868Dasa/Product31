import { describe, it, expect } from 'vitest';
import { extractAmount, tokenize, toBaseUnit } from '../src/lib/voice/normalize.js';
import { matchLine } from '../src/lib/voice/match.js';
import { createSession, ingest } from '../src/lib/voice/session.js';

const CATALOG = [
  { id: 'dal', name: 'Toor Dal', name_ta: 'துவரம் பருப்பு', brand: null, category: 'Pulses', sell_by: 'weight', base_unit: 'kg', price_basis: 'per_kg', min_qty: 0.25, max_qty: 10, step_qty: 0.25, in_stock: true },
  { id: 'oil', name: 'Sunflower Oil', name_ta: 'சூரியகாந்தி எண்ணெய்', brand: null, category: 'Oil', sell_by: 'weight', base_unit: 'l', price_basis: 'per_l', min_qty: 0.25, max_qty: 5, step_qty: 0.25, in_stock: true },
  { id: 'coco', name: 'Coconut', name_ta: 'தேங்காய்', brand: null, category: 'Fresh', sell_by: 'piece', base_unit: 'pcs', price_basis: 'per_piece', in_stock: true },
  { id: 'milk', name: 'Aavin Milk', name_ta: 'ஆவின் பால்', brand: 'Aavin', pack_size: '500ml', sell_by: 'pack', in_stock: true },
];

describe('extractAmount — weights & fractions', () => {
  it('"2.5 kg" → weight 2.5 kg', () => {
    expect(extractAmount(tokenize('2.5 kg dal')).weight).toEqual({ value: 2.5, unit: 'kg' });
  });
  it('"750 gram" → weight 750 g', () => {
    expect(extractAmount(tokenize('750 gram dal')).weight).toEqual({ value: 750, unit: 'g' });
  });
  it('"half kg" → 0.5 kg', () => {
    expect(extractAmount(tokenize('half kg dal')).weight).toEqual({ value: 0.5, unit: 'kg' });
  });
  it('"arai kilo" (Tamil romanised) → 0.5 kg', () => {
    expect(extractAmount(tokenize('arai kilo dal')).weight).toEqual({ value: 0.5, unit: 'kg' });
  });
  it('"onnarai kilo" → 1.5 kg', () => {
    expect(extractAmount(tokenize('onnarai kilo dal')).weight).toEqual({ value: 1.5, unit: 'kg' });
  });
  it('"1kg" glued → 1 kg', () => {
    expect(extractAmount(tokenize('1kg dal')).weight).toEqual({ value: 1, unit: 'kg' });
  });
  it('bare "2 dal" → count 2, no weight', () => {
    const a = extractAmount(tokenize('2 dal'));
    expect(a.count).toBe(2);
    expect(a.weight).toBeNull();
  });
});

describe('toBaseUnit', () => {
  it('g → kg', () => expect(toBaseUnit({ value: 750, unit: 'g' }, 'kg')).toBe(0.75));
  it('kg → kg', () => expect(toBaseUnit({ value: 2, unit: 'kg' }, 'kg')).toBe(2));
  it('ml → l', () => expect(toBaseUnit({ value: 500, unit: 'ml' }, 'l')).toBe(0.5));
});

describe('matchLine — weight items', () => {
  it('"750 gram toor dal" → 0.75 kg, resolved', () => {
    const l = matchLine('750 gram toor dal', CATALOG, { lang: 'en' });
    expect(l.needs).toBeNull();
    expect(l.matched_product_id).toBe('dal');
    expect(l.quantity).toBe(0.75);
    expect(l.unit).toBe('kg');
    expect(l.sell_by).toBe('weight');
    expect(l.price_basis).toBe('per_kg');
  });

  it('"toor dal" with no amount → needs quantity, offers real steps', () => {
    const l = matchLine('toor dal', CATALOG, { lang: 'en' });
    expect(l.needs).toBe('quantity');
    expect(l.options).toEqual(['250 g', '500 g', '1 kg', '2 kg']);
  });

  it('snaps to step: "300 gram" → 0.25 kg (nearest 0.25)', () => {
    expect(matchLine('300 gram dal', CATALOG, { lang: 'en' }).quantity).toBe(0.25);
  });

  it('clamps to max: "50 kg dal" → 10 kg', () => {
    expect(matchLine('50 kg dal', CATALOG, { lang: 'en' }).quantity).toBe(10);
  });

  it('oil is per litre: "2 litre oil" → 2 l', () => {
    const l = matchLine('2 litre sunflower oil', CATALOG, { lang: 'en' });
    expect(l.quantity).toBe(2);
    expect(l.unit).toBe('l');
    expect(l.price_basis).toBe('per_l');
  });

  it('piece item: "3 coconut" → count 3, unit pcs, no question', () => {
    const l = matchLine('3 coconut', CATALOG, { lang: 'en' });
    expect(l.needs).toBeNull();
    expect(l.sell_by).toBe('piece');
    expect(l.quantity).toBe(3);
    expect(l.unit).toBe('pcs');
  });
});

describe('session — weight clarification', () => {
  it('asks "how much?" then a "500 gram" answer resolves it', () => {
    const s = createSession({ shopSlug: 'X', lang: 'en' });
    const r1 = ingest(s, 'toor dal venum', CATALOG);
    expect(r1.reply).toMatch(/How much/);
    expect(s.lines).toHaveLength(0);

    const r2 = ingest(s, '500 gram', CATALOG);
    expect(r2.resolvedLine.matched_product_id).toBe('dal');
    expect(r2.resolvedLine.quantity).toBe(0.5);
    expect(s.lines).toHaveLength(1);
    expect(s.pending).toBeNull();
  });

  it('Tamil "arai kilo paruppu" resolves straight to 0.5 kg', () => {
    const s = createSession({ shopSlug: 'X', lang: 'ta' });
    const r = ingest(s, 'arai kilo toor dal', CATALOG);
    expect(r.resolvedLine?.quantity).toBe(0.5);
    expect(r.reply).toContain('துவரம் பருப்பு');
  });
});
