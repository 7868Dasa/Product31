import { describe, it, expect } from 'vitest';
import { haversineKm } from '../src/lib/geo.js';
import { nearbyQuerySchema, slugParamSchema } from '../src/modules/shops/shops.schemas.js';

describe('haversineKm', () => {
  it('is ~0 for the same point', () => {
    expect(haversineKm(11.74, 78.96, 11.74, 78.96)).toBeCloseTo(0, 5);
  });

  it('matches a known distance (Kallakurichi -> Chennai ~205 km)', () => {
    const d = haversineKm(11.7401, 78.9597, 13.0827, 80.2707);
    expect(d).toBeGreaterThan(190);
    expect(d).toBeLessThan(220);
  });

  it('is symmetric', () => {
    const a = haversineKm(11.74, 78.96, 11.81, 79.01);
    const b = haversineKm(11.81, 79.01, 11.74, 78.96);
    expect(a).toBeCloseTo(b, 10);
  });
});

describe('nearbyQuerySchema', () => {
  it('coerces string query params and defaults radius to 5', () => {
    const v = nearbyQuerySchema.parse({ lat: '11.74', lng: '78.96' });
    expect(v).toEqual({ lat: 11.74, lng: 78.96, radius_km: 5 });
  });

  it('rejects out-of-range latitude', () => {
    expect(() => nearbyQuerySchema.parse({ lat: '200', lng: '78' })).toThrow();
  });

  it('caps radius at 25 km', () => {
    expect(() => nearbyQuerySchema.parse({ lat: '11', lng: '78', radius_km: '100' })).toThrow();
  });
});

describe('slugParamSchema', () => {
  it('accepts an 8-char uppercase slug', () => {
    expect(slugParamSchema.parse({ slug: 'MRGNKLKI' }).slug).toBe('MRGNKLKI');
  });

  it('rejects lowercase / punctuation (no path tricks)', () => {
    expect(() => slugParamSchema.parse({ slug: 'mrgnklki' })).toThrow();
    expect(() => slugParamSchema.parse({ slug: '../etc' })).toThrow();
  });
});
