/**
 * OTP hashing. We never store or log the plaintext code (spec §8). A keyed
 * HMAC-SHA-256 with a server-side pepper is deterministic (so verify is a
 * direct comparison) and safe at rest.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export function hashOtp(code) {
  return createHmac('sha256', config.OTP_PEPPER).update(String(code)).digest('hex');
}

export function otpMatches(code, storedHash) {
  const a = Buffer.from(hashOtp(code), 'hex');
  const b = Buffer.from(String(storedHash), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
