import { describe, it, expect } from 'vitest';
import { segmentUtterance } from '../src/lib/voice/segment.js';
import { createSession, ingest } from '../src/lib/voice/session.js';

const CATALOG = [
  { id: 'milk', name: 'Aavin Milk', name_ta: 'ஆவின் பால்', brand: 'Aavin', pack_size: '500ml', sell_by: 'pack', in_stock: true },
  { id: 'rice', name: 'Idli Rice', name_ta: 'இட்லி அரிசி', sell_by: 'weight', base_unit: 'kg', price_basis: 'per_kg', min_qty: 0.25, max_qty: 10, step_qty: 0.25, in_stock: true },
  { id: 'dal', name: 'Toor Dal', name_ta: 'துவரம் பருப்பு', sell_by: 'weight', base_unit: 'kg', price_basis: 'per_kg', min_qty: 0.25, max_qty: 10, step_qty: 0.25, in_stock: true },
  { id: 'a50', name: 'Aachi Chicken Masala', brand: 'Aachi', pack_size: '50g', variant_group: 'acm', sell_by: 'pack', in_stock: true },
  { id: 'a100', name: 'Aachi Chicken Masala', brand: 'Aachi', pack_size: '100g', variant_group: 'acm', sell_by: 'pack', in_stock: true },
];

describe('segmentUtterance', () => {
  it('splits on commas', () => {
    expect(segmentUtterance('two milk, one rice, half kg dal')).toEqual([
      'two milk',
      'one rice',
      'half kg dal',
    ]);
  });
  it('splits on "and"', () => {
    expect(segmentUtterance('two milk and one rice')).toEqual(['two milk', 'one rice']);
  });
  it('splits on Tamil "um" / "appuram"', () => {
    expect(segmentUtterance('rendu milk appuram oru rice')).toEqual(['rendu milk', 'oru rice']);
  });
  it('keeps a single item as one segment', () => {
    expect(segmentUtterance('aachi chicken masala onnu')).toEqual(['aachi chicken masala onnu']);
  });
  it('does not over-split a two-word product name on a bare space', () => {
    expect(segmentUtterance('toor dal')).toEqual(['toor dal']);
  });
});

describe('session — multi-item in one utterance', () => {
  it('"two milk, half kg rice" adds both lines at once', () => {
    const s = createSession({ shopSlug: 'X', lang: 'en' });
    const r = ingest(s, 'two milk, half kg rice', CATALOG);
    expect(s.lines).toHaveLength(2);
    expect(r.resolvedLines.map((l) => l.matched_product_id).sort()).toEqual(['milk', 'rice']);
    const rice = s.lines.find((l) => l.matched_product_id === 'rice');
    expect(rice.quantity).toBe(0.5);
    const milk = s.lines.find((l) => l.matched_product_id === 'milk');
    expect(milk.quantity).toBe(2);
  });

  it('mixed: one resolves, one needs a size question → asks it, remembers the rest', () => {
    const s = createSession({ shopSlug: 'X', lang: 'en' });
    const r = ingest(s, 'two milk and aachi chicken masala', CATALOG);
    expect(s.lines).toHaveLength(1); // milk in
    expect(s.pending?.needs).toBe('pack_size');
    expect(r.reply).toMatch(/Which size/);

    const r2 = ingest(s, '100g', CATALOG);
    expect(s.lines).toHaveLength(2);
    expect(r2.resolvedLine.matched_product_id).toBe('a100');
    expect(s.pending).toBeNull();
  });

  it('two clarifications queue and are asked one at a time', () => {
    const s = createSession({ shopSlug: 'X', lang: 'en' });
    ingest(s, 'rice and dal', CATALOG); // both weight, both need "how much?"
    expect(s.pending?.needs).toBe('quantity');
    expect(s.queue).toHaveLength(1);

    ingest(s, '1 kg', CATALOG);
    expect(s.lines).toHaveLength(1);
    expect(s.pending?.needs).toBe('quantity'); // now asking the second

    ingest(s, '2 kg', CATALOG);
    expect(s.lines).toHaveLength(2);
    expect(s.pending).toBeNull();
  });
});
