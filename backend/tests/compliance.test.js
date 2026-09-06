import { describe, it, expect } from 'vitest';
import { consentSchema, deleteAccountSchema } from '../src/modules/account/account.schemas.js';

describe('consentSchema', () => {
  it('accepts a full grant', () => {
    const v = consentSchema.parse({
      consent_version: '2026-09-01',
      tos: true,
      privacy: true,
      age_confirmed: true,
      location: true,
      marketing: false,
    });
    expect(v.source).toBe('signup');
    expect(v.location).toBe(true);
  });

  it('rejects if terms / privacy / age not accepted', () => {
    const base = { consent_version: '1', tos: true, privacy: true, age_confirmed: true };
    expect(() => consentSchema.parse({ ...base, tos: false })).toThrow();
    expect(() => consentSchema.parse({ ...base, privacy: false })).toThrow();
    expect(() => consentSchema.parse({ ...base, age_confirmed: false })).toThrow();
  });

  it('location and marketing default to false', () => {
    const v = consentSchema.parse({
      consent_version: '1',
      tos: true,
      privacy: true,
      age_confirmed: true,
    });
    expect(v.location).toBe(false);
    expect(v.marketing).toBe(false);
  });
});

describe('deleteAccountSchema', () => {
  it('requires the exact word DELETE', () => {
    expect(deleteAccountSchema.parse({ confirm: 'DELETE' }).confirm).toBe('DELETE');
    expect(() => deleteAccountSchema.parse({ confirm: 'delete' })).toThrow();
    expect(() => deleteAccountSchema.parse({ confirm: 'yes' })).toThrow();
  });
});
