/**
 * JWT helpers. Short-lived access token (stateless) + refresh token whose
 * hash is stored in `refresh_tokens` so it can be revoked (spec §8).
 */
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from './errors.js';

const ISS = 'product31';

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, typ: 'access' }, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_TTL,
    issuer: ISS,
  });
}

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET, { issuer: ISS });
    if (payload.typ !== 'access') throw new Error('wrong token type');
    return payload;
  } catch {
    throw unauthorized('INVALID_TOKEN', 'Invalid or expired access token');
  }
}

/**
 * Create a refresh token. Returns the raw token (given to the client once) and
 * its sha-256 hash (stored). We use an opaque random string, not a JWT, so
 * revocation is a simple DB check.
 */
export function createRefreshToken() {
  const raw = randomBytes(48).toString('base64url');
  return { raw, hash: hashRefreshToken(raw) };
}

export function hashRefreshToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

/** Parse a TTL string like "30d" / "15m" into milliseconds. */
export function ttlToMs(ttl) {
  const m = /^(\d+)\s*(s|m|h|d)$/.exec(String(ttl).trim());
  if (!m) return Number(ttl) * 1000 || 0;
  const n = Number(m[1]);
  return n * { s: 1e3, m: 6e4, h: 3.6e6, d: 8.64e7 }[m[2]];
}
