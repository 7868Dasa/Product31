import { describe, it, expect } from 'vitest';
import { hashOtp, otpMatches } from '../src/lib/otp.js';
import { newOtpCode, newShopSlug, newOrderCode } from '../src/lib/ids.js';

describe('OTP hashing', () => {
  it('is deterministic for the same code', () => {
    expect(hashOtp('123456')).toBe(hashOtp('123456'));
  });

  it('differs for different codes', () => {
    expect(hashOtp('123456')).not.toBe(hashOtp('123457'));
  });

  it('never returns the plaintext', () => {
    expect(hashOtp('123456')).not.toContain('123456');
  });

  it('otpMatches accepts the right code and rejects wrong ones', () => {
    const h = hashOtp('420690');
    expect(otpMatches('420690', h)).toBe(true);
    expect(otpMatches('420691', h)).toBe(false);
    expect(otpMatches('', h)).toBe(false);
  });
});

describe('id generators', () => {
  it('newOtpCode is a zero-padded 6-digit string', () => {
    for (let i = 0; i < 200; i++) {
      const c = newOtpCode();
      expect(c).toMatch(/^\d{6}$/);
    }
  });

  it('shop slugs are 8 chars, uppercase, no look-alike letters, and non-repeating', () => {
    const seen = new Set();
    for (let i = 0; i < 1000; i++) {
      const s = newShopSlug();
      expect(s).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
      seen.add(s);
    }
    expect(seen.size).toBe(1000); // no collisions in 1k draws
  });

  it('order codes look like P31-XXXXXX', () => {
    expect(newOrderCode()).toMatch(/^P31-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  });
});
