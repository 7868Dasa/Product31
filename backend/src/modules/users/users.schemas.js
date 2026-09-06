import { z } from 'zod';

export const updateMeSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(254).optional().or(z.literal('')),
    area: z.string().trim().max(160).optional(),
    latitude: z.coerce.number().gte(-90).lte(90).optional(),
    longitude: z.coerce.number().gte(-180).lte(180).optional(),
    preferred_language: z.enum(['en', 'ta']).optional(),
    fcm_token: z.string().trim().max(512).optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'Provide at least one field to update');
