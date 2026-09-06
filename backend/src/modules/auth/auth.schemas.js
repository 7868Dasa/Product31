import { z } from 'zod';

/**
 * Normalise a phone number to E.164. Accepts a bare 10-digit Indian mobile
 * (assumes +91) or an already-prefixed international number.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-()]/g, ''))
  .refine((v) => /^(\+?\d{10,15})$/.test(v), 'Enter a valid phone number')
  .transform((v) => {
    if (/^\d{10}$/.test(v)) return `+91${v}`;
    if (v.startsWith('+')) return v;
    return `+${v}`;
  })
  .refine((v) => /^\+[1-9]\d{9,14}$/.test(v), 'Enter a valid phone number');

export const otpRequestSchema = z.object({
  phone_number: phoneSchema,
  purpose: z.enum(['login', 'onboarding']).default('login'),
});

export const otpVerifySchema = z.object({
  phone_number: phoneSchema,
  otp_code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, 'Enter the code from the SMS'),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(20),
});

export const logoutSchema = z.object({
  refresh_token: z.string().min(20),
});
