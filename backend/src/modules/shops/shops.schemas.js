import { z } from 'zod';
import { phoneSchema } from '../auth/auth.schemas.js';

export const createShopSchema = z.object({
  shop_name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  address: z.string().trim().min(4).max(300),
  owner_name: z.string().trim().min(2).max(120),
  phone_number: phoneSchema,
  latitude: z.coerce.number().gte(-90).lte(90).optional(),
  longitude: z.coerce.number().gte(-180).lte(180).optional(),
  opening_hours: z.string().trim().max(120).optional(),
  price_display_mode: z.enum(['exact', 'range', 'hidden']).default('exact'),
  prep_time_minutes: z.coerce.number().int().min(0).max(120).optional(),
  // A real JSON boolean, not coerced — z.coerce.boolean() runs JS Boolean(),
  // so a string body like "false" would coerce to true.
  auto_confirm: z.boolean().optional(),
});

export const updateShopSchema = z
  .object({
    shop_name: z.string().trim().min(2).max(120),
    category: z.string().trim().min(2).max(60),
    address: z.string().trim().min(4).max(300),
    owner_name: z.string().trim().min(2).max(120),
    phone_number: phoneSchema,
    latitude: z.coerce.number().gte(-90).lte(90),
    longitude: z.coerce.number().gte(-180).lte(180),
    opening_hours: z.string().trim().max(120),
    price_display_mode: z.enum(['exact', 'range', 'hidden']),
    prep_time_minutes: z.coerce.number().int().min(0).max(120),
    auto_confirm: z.boolean(),
    is_open: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
  radius_km: z.coerce.number().positive().max(25).default(5),
});

export const slugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[0-9A-Z]{4,16}$/, 'Invalid shop link'),
});
