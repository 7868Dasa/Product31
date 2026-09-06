/**
 * Non-enumerable identifier helpers (spec §4 / §8).
 * Shop slugs and order codes must be random, not sequential, so nobody can
 * walk the URL space by incrementing a number.
 */
import { randomBytes, randomInt } from 'node:crypto';

// Crockford-ish base32 without I, L, O, U (avoids look-alikes / rude words).
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomToken(len) {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** 8-char public shop slug, e.g. "K7M2Q9AB". */
export function newShopSlug() {
  return randomToken(8);
}

/**
 * Short order code the shopkeeper reads aloud at the counter, e.g. "B4K9".
 * Only unique per (shop, day) — see migration 0008 — so 4 chars is plenty and
 * stays easy to say and type. The orders service retries on the rare collision.
 */
export function newOrderCode() {
  return randomToken(4);
}

/** Server-side idempotency key fallback if the client didn't send one. */
export function newIdempotencyKey() {
  return randomBytes(16).toString('hex');
}

/** Numeric OTP of the given length (default 6), as a zero-padded string. */
export function newOtpCode(len = 6) {
  const max = 10 ** len;
  return String(randomInt(0, max)).padStart(len, '0');
}
