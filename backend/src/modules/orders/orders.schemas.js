import { z } from 'zod';
import { STATUS } from '../../lib/orderState.js';

/**
 * One cart line. `item_id` is the shop_inventory row id (what the public
 * inventory API returns as `id`). Price is NEVER taken from the client — the
 * service recomputes it from that row. See orders.service.
 */
const orderLineSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.coerce.number().positive().max(999),
});

export const placeOrderSchema = z.object({
  items: z.array(orderLineSchema).min(1).max(50),
  // The client sends a fresh UUID per checkout attempt; a retry with the same
  // key returns the same order instead of creating a second one.
  idempotency_key: z.string().trim().min(8).max(64),
  pickup_slot_label: z.string().trim().max(40).optional(),
});

export const orderIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const shopOrdersQuerySchema = z.object({
  status: z.enum([...Object.values(STATUS), 'active']).optional(),
});

export const transitionSchema = z.object({
  action: z.enum(['accept', 'reject', 'ready', 'collect', 'no_show']),
  reason: z.string().trim().min(2).max(200).optional(),
});

// Shopper edits their own pickup time — only while the order is still early
// (PENDING_ACCEPTANCE / ACCEPTED); the service enforces that.
export const updatePickupSchema = z.object({
  pickup_slot_label: z.string().trim().min(1).max(40),
});
