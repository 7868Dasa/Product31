/**
 * Order lifecycle (spec build step 4, scoped down — see plan-eng-review).
 *
 * The forward-only state machine lives in lib/orderState.js as pure functions
 * so it is testable without a database and identical to the frontend copy.
 * This module is the DB-touching half: place, list, transition, and LAZY
 * expiry (a PENDING order past its acceptance SLA flips to EXPIRED on the next
 * read — no background worker).
 *
 *   PLACE                    LIST                         TRANSITION
 *   ─────                    ────                         ──────────
 *   recompute prices    ┌─► reconcileExpiredForShop  ┌─► owner check
 *   server-side         │   (bulk UPDATE before      │   nextStatus() guard
 *   idempotency key ────┤    the SELECT)             ├─► optimistic UPDATE
 *   order_code retry    │   reconcileExpiredForUser  │    WHERE status = <seen>
 *   history row         └─► serialize per viewer     ├─► order_status_history
 *                                                    └─► reject → best-effort SMS
 */
import { db } from '../../db.js';
import { notFound, forbidden, conflict, badRequest } from '../../lib/errors.js';
import { logger, maskPhone } from '../../lib/logger.js';
import { newOrderCode } from '../../lib/ids.js';
import { sendRejectionSms } from '../../lib/sms.js';
import {
  STATUS,
  ACTIVE,
  TRANSITIONS,
  nextStatus,
  stampFor,
  needsReason,
  computeTotals,
} from '../../lib/orderState.js';

const iso = (v) => (v ? new Date(v).toISOString() : null);

function isUniqueViolation(err, constraint) {
  if (!err || err.code !== '23505') return false;
  if (!constraint) return true;
  return String(err.constraint) === constraint || String(err.message).includes(constraint);
}

/** The unit an order line's `quantity` is counted in. */
function unitFor(inv) {
  if (inv.sell_by === 'weight') return inv.base_unit || 'kg';
  if (inv.sell_by === 'piece') return 'pcs';
  return 'pack';
}

// ── serialization ────────────────────────────────────────────────────────────

/**
 * Shape an order for the client. `viewer` decides what's exposed:
 *   - 'owner'   : shopkeeper — always sees prices + a masked customer phone
 *   - 'shopper' : the order's user — sees "price at counter" (no numbers) while
 *                 a HIDDEN-price shop's order is still PENDING; the real total
 *                 appears once the shop accepts (plan-eng-review Q5).
 */
function serializeOrder(order, items, { viewer, priceMode }) {
  const hidePrice =
    viewer === 'shopper' && priceMode === 'hidden' && order.status === STATUS.PENDING_ACCEPTANCE;

  const out = {
    id: order.id,
    order_code: order.order_code,
    shop_slug: order.shop_slug,
    shop_name: order.shop_name,
    status: order.status,
    created_at: iso(order.created_at),
    pending_acceptance_at: iso(order.pending_acceptance_at),
    accepted_at: iso(order.accepted_at),
    rejected_at: iso(order.rejected_at),
    expired_at: iso(order.expired_at),
    ready_at: iso(order.ready_at),
    collected_at: iso(order.collected_at),
    no_show_at: iso(order.no_show_at),
    pickup_slot_label: order.pickup_slot_label || 'ASAP',
    rejection_reason: order.rejection_reason || null,
    price_mode: priceMode,
    price_pending: hidePrice,
    mine: viewer === 'shopper',
    items: items.map((it) => ({
      name: it.product_name,
      name_ta: it.name_ta || null,
      pack_size: it.pack_size || null,
      quantity: Number(it.quantity),
      sell_by: it.sell_by || 'pack',
      unit: it.unit || 'pack',
      price_basis: it.price_basis || 'per_pack',
      ...(hidePrice
        ? {}
        : { unit_price: Number(it.unit_price), line_total: Number(it.line_total) }),
    })),
    ...(hidePrice ? {} : { subtotal_amount: Number(order.subtotal_amount) }),
  };

  if (viewer === 'owner') {
    out.customer_name = order.customer_name || `Order ${order.order_code}`;
    out.customer_phone_masked = order.customer_phone ? maskPhone(order.customer_phone) : null;
  }
  return out;
}

// ── loaders ──────────────────────────────────────────────────────────────────

async function loadFull(orderId) {
  const order = await db('orders as o')
    .join('shops as s', 's.id', 'o.shop_id')
    .join('users as u', 'u.id', 'o.user_id')
    .where('o.id', orderId)
    .first(
      'o.*',
      's.slug as shop_slug',
      's.shop_name as shop_name',
      's.owner_user_id as _owner_user_id',
      's.price_display_mode as _price_mode',
      's.acceptance_sla_minutes as _sla',
      'u.full_name as customer_name',
      'u.phone_number as customer_phone',
    );
  if (!order) throw notFound('ORDER_NOT_FOUND', 'That order could not be found.');

  const items = await db('order_items as oi')
    .leftJoin('master_products as mp', 'mp.id', 'oi.product_id')
    .where('oi.order_id', orderId)
    .select('oi.*', 'mp.name_ta', 'mp.pack_size')
    .orderBy('oi.id', 'asc');

  const shop = {
    id: order.shop_id,
    slug: order.shop_slug,
    shop_name: order.shop_name,
    owner_user_id: order._owner_user_id,
    price_display_mode: order._price_mode,
    acceptance_sla_minutes: order._sla,
  };
  return { order, items, shop };
}

/** Attach items to a list of raw order rows in ONE query (no N+1). */
async function attachItems(rows) {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return new Map();
  const items = await db('order_items as oi')
    .leftJoin('master_products as mp', 'mp.id', 'oi.product_id')
    .whereIn('oi.order_id', ids)
    .select('oi.*', 'mp.name_ta', 'mp.pack_size')
    .orderBy('oi.id', 'asc');
  const byOrder = new Map();
  for (const it of items) {
    if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
    byOrder.get(it.order_id).push(it);
  }
  return byOrder;
}

// ── lazy expiry ──────────────────────────────────────────────────────────────

async function writeExpiryHistory(idRows) {
  if (!idRows || !idRows.length) return;
  await db('order_status_history').insert(
    idRows.map((r) => ({
      order_id: r.id,
      from_status: STATUS.PENDING_ACCEPTANCE,
      to_status: STATUS.EXPIRED,
      changed_by: 'system',
      note: 'acceptance SLA elapsed',
    })),
  );
}

/** Bulk: expire every stale PENDING order for one shop, before listing them. */
async function reconcileExpiredForShop(shopId, slaMinutes) {
  const res = await db.raw(
    `update orders set status = ?, expired_at = now(), updated_at = now()
       where shop_id = ? and status = ?
         and pending_acceptance_at < now() - (? * interval '1 minute')
     returning id`,
    [STATUS.EXPIRED, shopId, STATUS.PENDING_ACCEPTANCE, slaMinutes],
  );
  await writeExpiryHistory(res.rows || res);
}

/** Bulk: expire every stale PENDING order across all of a shopper's shops. */
async function reconcileExpiredForUser(userId) {
  const res = await db.raw(
    `update orders o set status = ?, expired_at = now(), updated_at = now()
       from shops s
      where o.shop_id = s.id and o.user_id = ? and o.status = ?
        and o.pending_acceptance_at < now() - (s.acceptance_sla_minutes * interval '1 minute')
     returning o.id`,
    [STATUS.EXPIRED, userId, STATUS.PENDING_ACCEPTANCE],
  );
  await writeExpiryHistory(res.rows || res);
}

/** One order. Returns true if it just expired. */
async function reconcileOne(orderId, slaMinutes) {
  const res = await db.raw(
    `update orders set status = ?, expired_at = now(), updated_at = now()
       where id = ? and status = ?
         and pending_acceptance_at < now() - (? * interval '1 minute')
     returning id`,
    [STATUS.EXPIRED, orderId, STATUS.PENDING_ACCEPTANCE, slaMinutes],
  );
  const changed = res.rows || res;
  await writeExpiryHistory(changed);
  return changed.length > 0;
}

// ── place ────────────────────────────────────────────────────────────────────

async function insertOrderWithCode(trx, base) {
  for (let i = 0; i < 6; i += 1) {
    const order_code = newOrderCode();
    try {
      // eslint-disable-next-line no-await-in-loop
      const [row] = await trx('orders').insert({ ...base, order_code }).returning('id');
      return row.id;
    } catch (err) {
      if (isUniqueViolation(err, 'orders_shop_day_code_uidx')) continue; // retry a new code
      throw err;
    }
  }
  throw conflict('ORDER_CODE_ALLOC_FAILED', 'Could not allocate an order code. Try again.');
}

/**
 * @param {{ userId, slug, items, idempotencyKey, pickupSlotLabel }} p
 */
export async function placeOrder({ userId, slug, items, idempotencyKey, pickupSlotLabel }) {
  const shop = await db('shops').where({ slug }).first();
  if (!shop) throw notFound('SHOP_NOT_FOUND', 'That shop could not be found.');

  // Idempotency fast path: this key already produced an order.
  const existing = await db('orders').where({ idempotency_key: idempotencyKey }).first();
  if (existing) {
    if (existing.user_id !== userId) {
      throw conflict('IDEMPOTENCY_KEY_REUSED', 'That request key belongs to another order.');
    }
    const full = await loadFull(existing.id);
    return serializeOrder(full.order, full.items, {
      viewer: 'shopper',
      priceMode: shop.price_display_mode,
    });
  }

  if (!shop.is_open) throw conflict('SHOP_CLOSED', 'This shop is not taking orders right now.');

  const itemIds = [...new Set(items.map((i) => i.item_id))];
  const invRows = await db('shop_inventory as si')
    .join('master_products as mp', 'mp.id', 'si.product_id')
    .where('si.shop_id', shop.id)
    .whereIn('si.id', itemIds)
    .select(
      'si.id',
      'si.product_id',
      'si.price',
      'si.sell_by',
      'si.price_basis',
      'si.is_available',
      'mp.name',
      'mp.base_unit',
    );
  const inv = new Map(invRows.map((r) => [r.id, r]));

  for (const it of items) {
    const row = inv.get(it.item_id);
    if (!row) {
      throw badRequest('ITEM_NOT_SOLD_HERE', 'One of those items is not sold at this shop.', {
        item_id: it.item_id,
      });
    }
    // Honour the shop's on/off toggle. NOT stock tracking (plan-eng-review Q4).
    if (!row.is_available) {
      throw conflict('ITEM_NOT_AVAILABLE', `${row.name} is currently unavailable.`, {
        item_id: it.item_id,
      });
    }
  }

  let totals;
  try {
    totals = computeTotals(
      items.map((it) => ({ product_id: it.item_id, quantity: it.quantity })),
      (id) => Number(inv.get(id).price),
    );
  } catch (err) {
    if (err.code === 'BAD_QUANTITY') {
      throw badRequest('BAD_QUANTITY', 'Invalid quantity for an item.', { item_id: err.product_id });
    }
    if (err.code === 'ITEM_NOT_SOLD_HERE') {
      throw badRequest('ITEM_NOT_SOLD_HERE', 'One of those items is not sold at this shop.', {
        item_id: err.product_id,
      });
    }
    throw err;
  }
  const lineById = new Map(totals.lines.map((l) => [l.product_id, l]));

  let orderId;
  try {
    orderId = await db.transaction(async (trx) => {
      const oid = await insertOrderWithCode(trx, {
        user_id: userId,
        shop_id: shop.id,
        status: STATUS.PENDING_ACCEPTANCE,
        idempotency_key: idempotencyKey,
        subtotal_amount: totals.subtotal,
        payment_method: 'COD',
        pickup_slot_label: pickupSlotLabel || 'ASAP',
        pending_acceptance_at: trx.fn.now(),
      });

      await trx('order_items').insert(
        items.map((it) => {
          const row = inv.get(it.item_id);
          const line = lineById.get(it.item_id);
          return {
            order_id: oid,
            product_id: row.product_id,
            product_name: row.name,
            quantity: line.quantity,
            unit_price: line.unit_price,
            line_total: line.line_total,
            sell_by: row.sell_by,
            unit: unitFor(row),
            price_basis: row.price_basis,
          };
        }),
      );

      await trx('order_status_history').insert({
        order_id: oid,
        from_status: null,
        to_status: STATUS.PENDING_ACCEPTANCE,
        changed_by: `user:${userId}`,
        note: null,
      });
      return oid;
    });
  } catch (err) {
    // Two concurrent checkouts with the same key: one wins, the other lands here.
    if (isUniqueViolation(err, 'orders_idempotency_key_unique')) {
      const dup = await db('orders').where({ idempotency_key: idempotencyKey }).first();
      if (dup && dup.user_id === userId) {
        const full = await loadFull(dup.id);
        return serializeOrder(full.order, full.items, {
          viewer: 'shopper',
          priceMode: shop.price_display_mode,
        });
      }
    }
    throw err;
  }

  logger.info({ order_id: orderId, shop: slug }, 'order placed');
  const full = await loadFull(orderId);
  return serializeOrder(full.order, full.items, {
    viewer: 'shopper',
    priceMode: shop.price_display_mode,
  });
}

// ── list ─────────────────────────────────────────────────────────────────────

export async function listShopQueue({ ownerUserId, slug, status }) {
  const shop = await db('shops').where({ slug }).first();
  if (!shop) throw notFound('SHOP_NOT_FOUND', 'That shop could not be found.');
  if (shop.owner_user_id !== ownerUserId) {
    throw forbidden('NOT_SHOP_OWNER', 'This is not your shop.');
  }

  await reconcileExpiredForShop(shop.id, shop.acceptance_sla_minutes);

  const q = db('orders').where({ shop_id: shop.id });
  if (status === 'active') q.whereIn('status', ACTIVE);
  else if (status) q.where({ status });
  const rows = await q.orderBy('created_at', 'asc'); // queue: oldest first

  const withShop = rows.map((r) => ({ ...r, shop_slug: shop.slug, shop_name: shop.shop_name }));
  const byOrder = await attachItems(withShop);
  return withShop.map((o) =>
    serializeOrder(o, byOrder.get(o.id) || [], {
      viewer: 'owner',
      priceMode: shop.price_display_mode,
    }),
  );
}

export async function listMyOrders({ userId }) {
  await reconcileExpiredForUser(userId);

  const rows = await db('orders as o')
    .join('shops as s', 's.id', 'o.shop_id')
    .where('o.user_id', userId)
    .orderBy('o.created_at', 'desc')
    .select('o.*', 's.slug as shop_slug', 's.shop_name as shop_name', 's.price_display_mode as _price_mode');

  const byOrder = await attachItems(rows);
  return rows.map((o) =>
    serializeOrder(o, byOrder.get(o.id) || [], {
      viewer: 'shopper',
      priceMode: o._price_mode,
    }),
  );
}

export async function getOrder({ actorUserId, orderId }) {
  const { order, items, shop } = await loadFull(orderId);
  const isShopper = order.user_id === actorUserId;
  const isOwner = shop.owner_user_id === actorUserId;
  if (!isShopper && !isOwner) throw forbidden('NOT_YOUR_ORDER', 'You cannot view this order.');

  if (order.status === STATUS.PENDING_ACCEPTANCE) {
    const expired = await reconcileOne(orderId, shop.acceptance_sla_minutes);
    if (expired) return getOrder({ actorUserId, orderId }); // re-read once
  }
  return serializeOrder(order, items, {
    viewer: isOwner ? 'owner' : 'shopper',
    priceMode: shop.price_display_mode,
  });
}

// ── transition ───────────────────────────────────────────────────────────────

export async function transition({ actorUserId, orderId, action, reason }) {
  const t = TRANSITIONS[action];
  if (!t) throw badRequest('UNKNOWN_ACTION', 'Unknown order action.');

  const { shop } = await loadFull(orderId);

  if (t.actor === 'owner' && shop.owner_user_id !== actorUserId) {
    throw forbidden('NOT_SHOP_OWNER', 'Only the shop can do that.');
  }
  if (needsReason(action) && !reason) {
    throw badRequest('REASON_REQUIRED', 'A reason is required to reject an order.');
  }

  // Expire first so you can't accept an order the shopper already saw die.
  await reconcileOne(orderId, shop.acceptance_sla_minutes);

  const seen = await db('orders').where({ id: orderId }).first();
  const to = nextStatus(seen.status, action);
  if (!to) {
    throw conflict('ILLEGAL_TRANSITION', `Cannot ${action} an order that is ${seen.status}.`, {
      from: seen.status,
      action,
    });
  }

  const stamp = stampFor(action);
  await db.transaction(async (trx) => {
    // Optimistic guard: only move if still in the status we just read.
    const n = await trx('orders')
      .where({ id: orderId, status: seen.status })
      .update({
        status: to,
        [stamp]: trx.fn.now(),
        updated_at: trx.fn.now(),
        ...(action === 'reject' ? { rejection_reason: reason } : {}),
      });
    if (n === 0) {
      throw conflict('ORDER_CHANGED', 'This order was just updated. Refresh and try again.');
    }
    await trx('order_status_history').insert({
      order_id: orderId,
      from_status: seen.status,
      to_status: to,
      changed_by: `shop:${shop.id}`,
      note: reason || null,
    });
  });

  const full = await loadFull(orderId);

  if (to === STATUS.REJECTED) {
    // Best-effort. Never blocks the transition, never throws (spec §8: no PII in logs).
    sendRejectionSms(full.order.customer_phone, {
      order_code: full.order.order_code,
      shop_name: shop.shop_name,
      reason,
    }).catch((err) => logger.error({ err }, 'rejection SMS dispatch failed'));
  }

  return serializeOrder(full.order, full.items, {
    viewer: 'owner',
    priceMode: shop.price_display_mode,
  });
}
