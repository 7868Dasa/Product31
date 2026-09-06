import { describe, it, expect } from 'vitest';
import { phoneSchema, otpVerifySchema } from '../src/modules/auth/auth.schemas.js';
import { updateMeSchema } from '../src/modules/users/users.schemas.js';

describe('phoneSchema', () => {
  it('normalises a bare 10-digit Indian mobile to +91', () => {
    expect(phoneSchema.parse('9876543210')).toBe('+919876543210');
  });

  it('keeps an already-prefixed number', () => {
    expect(phoneSchema.parse('+919876543210')).toBe('+919876543210');
  });

  it('strips spaces, dashes and brackets', () => {
    expect(phoneSchema.parse(' (98765) 43210 ')).toBe('+919876543210');
  });

  it('rejects nonsense', () => {
    expect(() => phoneSchema.parse('12345')).toThrow();
    expect(() => phoneSchema.parse('abcdefghij')).toThrow();
  });
});

describe('otpVerifySchema', () => {
  it('accepts a 6-digit code', () => {
    const v = otpVerifySchema.parse({ phone_number: '9876543210', otp_code: '123456' });
    expect(v.otp_code).toBe('123456');
  });

  it('rejects a non-numeric code', () => {
    expect(() =>
      otpVerifySchema.parse({ phone_number: '9876543210', otp_code: '12ab56' }),
    ).toThrow();
  });
});

describe('updateMeSchema', () => {
  it('requires at least one field', () => {
    expect(() => updateMeSchema.parse({})).toThrow();
  });

  it('rejects unknown fields (no mass assignment)', () => {
    expect(() => updateMeSchema.parse({ no_show_count: 0 })).toThrow();
    expect(() => updateMeSchema.parse({ status: 'active' })).toThrow();
  });

  it('accepts a valid partial update', () => {
    const v = updateMeSchema.parse({ full_name: 'Meena', preferred_language: 'ta' });
    expect(v).toEqual({ full_name: 'Meena', preferred_language: 'ta' });
  });
});
