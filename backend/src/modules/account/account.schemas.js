import { z } from 'zod';

/**
 * DPDP consent. `tos` / `privacy` / `age_confirmed` are required to use the
 * service at all — you cannot un-accept them and keep an account. `location`
 * and `marketing` are genuinely optional and default off.
 */
export const consentSchema = z.object({
  consent_version: z.string().trim().min(1).max(40),
  tos: z.literal(true),
  privacy: z.literal(true),
  age_confirmed: z.literal(true),
  location: z.boolean().default(false),
  marketing: z.boolean().default(false),
  source: z.enum(['signup', 'settings']).default('signup'),
});

/** Deletion requires an explicit typed confirmation. */
export const deleteAccountSchema = z.object({
  confirm: z.literal('DELETE'),
});
