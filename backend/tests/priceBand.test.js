import { describe, it, expect } from 'vitest';
import { priceBand } from '../src/modules/shops/shops.service.js';

describe('priceBand', () => {
  it('brackets the real price', () => {
    const b = priceBand(42);
    expect(b.price_min).toBeLessThanOrEqual(42);
    expect(b.price_max).toBeGreaterThanOrEqual(42);
  });

  it('snaps to multiples of 5', () => {
    for (const p of [22, 45, 95, 155, 340]) {
      const b = priceBand(p);
      expect(b.price_min % 5).toBe(0);
      expect(b.price_max % 5).toBe(0);
    }
  });

  it('always has a non-zero span and a positive floor', () => {
    for (const p of [1, 5, 10, 500]) {
      const b = priceBand(p);
      expect(b.price_min).toBeGreaterThan(0);
      expect(b.price_max).toBeGreaterThan(b.price_min);
    }
  });
});
