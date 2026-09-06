import { describe, it, expect } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  createRefreshToken,
  hashRefreshToken,
  ttlToMs,
} from '../src/lib/jwt.js';

describe('access tokens', () => {
  it('round-trips the user id in sub', () => {
    const token = signAccessToken({ id: 'user-123' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-123');
    expect(payload.typ).toBe('access');
  });

  it('rejects a garbage token', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
  });

  it('rejects a token signed with the wrong secret', () => {
    // token from another issuer/secret — tampered
    const bad =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.' + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    expect(() => verifyAccessToken(bad)).toThrow();
  });
});

describe('refresh tokens', () => {
  it('creates an opaque token and a stable sha-256 hash', () => {
    const { raw, hash } = createRefreshToken();
    expect(raw.length).toBeGreaterThan(40);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(raw)).toBe(hash);
  });
});

describe('ttlToMs', () => {
  it('parses units', () => {
    expect(ttlToMs('15m')).toBe(900_000);
    expect(ttlToMs('30d')).toBe(2_592_000_000);
    expect(ttlToMs('1h')).toBe(3_600_000);
    expect(ttlToMs('45s')).toBe(45_000);
  });
});
