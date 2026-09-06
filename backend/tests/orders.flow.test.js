/**
 * Order lifecycle against a real Postgres. Skipped automatically when no
 * database is reachable (so `npm test` stays green before DB setup). To run it:
 *
 *   cd backend && node --env-file=.env node_modules/knex/bin/cli.js migrate:latest
 *   DATABASE_URL=... npm test
 *
 * Covers the CRITICAL paths from the plan-eng-review coverage diagram:
 *   price recompute · idempotency · actor authz · illegal-transition guard ·
 *   lazy-expiry consistency (queue == history) · reject SMS is best-effort.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, pingDb, closeDb } from '../src/db.js';
import { signAccessToken } from '../src/lib/jwt.js';
import { newShopSlug } from '../src/lib/ids.js';

const dbUp = await pingDb()
  .then(() => true)
  .catch(() => false);
const app = createApp();

const tag = String(Date.now()).slice(-9);
const shopperPhone = `+9198${tag}`;
const ownerPhone = `+9197${tag}`;
const slug = newShopSlug();

let shopperId;
let ownerId;
let shopId;
let riceId;
let dalId;
let riceItemId; // shop_inventory row id — what the cart carries
let dalItemId;
let shopperTok;
let ownerTok;
let strangerTok;

describe.skipIf(!dbUp)('order lifecycle (needs Postgres)', () => {
  beforeAll(async () => {
    const [shopper] = await db('users')
      .insert({ phone_number: shopperPhone, full_name: 'Test Shopper', is_phone_verified: true })
      .returning('id');
    const [owner] = await db('users')
      .insert({ phone_number: ownerPhone, full_name: 'Test Owner', is_phone_verified: true })
      .returning('id');
    const [stranger] = await db('users')
      .insert({ phone_number: `+9196${tag}`, full_name: 'Nosy', is_phone_verified: true })
      .returning('id');
    shopperId = shopper.id;
    ownerId = owner.id;

    const [shop] = await db('shops')
      .insert({
        owner_user_id: ownerId,
        shop_name: 'Test Kirana',
        phone_number: ownerPhone,
        slug,
        is_open: true,
        acceptance_sla_minutes: 5,
        price_display_mode: 'exact',
      })
      .returning('id');
    shopId = shop.id;

    const [rice] = await db('master_products')
      .insert({ name: `Rice ${tag}`, default_sell_by: 'weight', base_unit: 'kg' })
      .returning('id');
    const [dal] = await db('master_products')
      .insert({ name: `Dal ${tag}`, default_sell_by: 'weight', base_unit: 'kg' })
      .returning('id');
    riceId = rice.id;
    dalId = dal.id;

    const invRows = await db('shop_inventory')
      .insert([
        { shop_id: shopId, product_id: riceId, price: 60, stock_amount: 100, is_available: true, sell_by: 'weight', price_basis: 'per_kg' },
        { shop_id: shopId, product_id: dalId, price: 145, stock_amount: 50, is_available: true, sell_by: 'weight', price_basis: 'per_kg' },
      ])
      .returning(['id', 'product_id']);
    riceItemId = invRows.find((r) => r.product_id === riceId).id;
    dalItemId = invRows.find((r) => r.product_id === dalId).id;

    shopperTok = signAccessToken({ id: shopperId });
    ownerTok = signAccessToken({ id: ownerId });
    strangerTok = signAccessToken({ id: stranger.id });
  });

  afterAll(async () => {
    if (shopId) {
      const orderIds = (await db('orders').where({ shop_id: shopId }).select('id')).map((r) => r.id);
      if (orderIds.length) {
        await db('order_status_history').whereIn('order_id', orderIds).del();
        await db('order_items').whereIn('order_id', orderIds).del();
      }
      await db('orders').where({ shop_id: shopId }).del();
      await db('shop_inventory').where({ shop_id: shopId }).del();
      await db('shops').where({ id: shopId }).del();
    }
    await db('master_products').whereIn('id', [riceId, dalId].filter(Boolean)).del();
    await db('users').where('phone_number', 'like', `%${tag}`).del();
    await closeDb();
  });

  const auth = (t) => ({ Authorization: `Bearer ${t}` });
  let orderId;
  let orderCode;

  it('requires a signed-in user to place an order', async () => {
    const res = await request(app)
      .post(`/api/v1/shops/${slug}/orders`)
      .send({ items: [{ product_id: riceId, quantity: 1 }], idempotency_key: `k-${tag}-x` });
    expect(res.status).toBe(401);
  });

  it('recomputes the total from shop prices, ignoring the client', async () => {
    const res = await request(app)
      .post(`/api/v1/shops/${slug}/orders`)
      .set(auth(shopperTok))
      .send({
        items: [
          { item_id: riceItemId, quantity: 2, unit_price: 1 }, // client lies
          { item_id: dalItemId, quantity: 0.25 },
        ],
        idempotency_key: `k-${tag}-1`,
        pickup_slot_label: 'ASAP',
      });
    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('PENDING_ACCEPTANCE');
    expect(res.body.order.subtotal_amount).toBe(156.25); // 2*60 + 0.25*145
    expect(res.body.order.items[0].unit_price).toBe(60);
    expect(res.body.order.items[1].quantity).toBe(0.25);
    orderId = res.body.order.id;
    orderCode = res.body.order.order_code;
    expect(orderCode).toMatch(/^[0-9A-Z]{4}$/);
  });

  it('is idempotent — same key returns the same order, no second row', async () => {
    const before = await db('orders').where({ shop_id: shopId }).count('* as n').first();
    const res = await request(app)
      .post(`/api/v1/shops/${slug}/orders`)
      .set(auth(shopperTok))
      .send({ items: [{ item_id: riceItemId, quantity: 9 }], idempotency_key: `k-${tag}-1` });
    expect(res.status).toBe(201);
    expect(res.body.order.id).toBe(orderId);
    const after = await db('orders').where({ shop_id: shopId }).count('* as n').first();
    expect(Number(after.n)).toBe(Number(before.n));
  });

  it('rejects an item the shop does not sell', async () => {
    const res = await request(app)
      .post(`/api/v1/shops/${slug}/orders`)
      .set(auth(shopperTok))
      .send({
        items: [{ item_id: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
        idempotency_key: `k-${tag}-2`,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ITEM_NOT_SOLD_HERE');
  });

  it('shows the order in the shopper history', async () => {
    const res = await request(app).get('/api/v1/orders/mine').set(auth(shopperTok));
    expect(res.status).toBe(200);
    expect(res.body.orders.some((o) => o.id === orderId)).toBe(true);
    expect(res.body.orders.every((o) => o.mine)).toBe(true);
  });

  it('only the shop owner can see the queue', async () => {
    const denied = await request(app).get(`/api/v1/shops/${slug}/orders`).set(auth(strangerTok));
    expect(denied.status).toBe(403);
    const ok = await request(app).get(`/api/v1/shops/${slug}/orders`).set(auth(ownerTok));
    expect(ok.status).toBe(200);
    expect(ok.body.orders[0].customer_phone_masked).toMatch(/\*/);
    expect(ok.body.orders[0]).not.toHaveProperty('customer_phone');
  });

  it('a non-owner cannot transition the order', async () => {
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/transitions`)
      .set(auth(strangerTok))
      .send({ action: 'accept' });
    expect(res.status).toBe(403);
  });

  it('rejects an illegal transition (PENDING -> collect)', async () => {
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/transitions`)
      .set(auth(ownerTok))
      .send({ action: 'collect' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
  });

  it('requires a reason to reject', async () => {
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/transitions`)
      .set(auth(ownerTok))
      .send({ action: 'reject' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('REASON_REQUIRED');
  });

  it('walks the happy path accept -> ready -> collect with history rows', async () => {
    for (const action of ['accept', 'ready', 'collect']) {
      const res = await request(app)
        .post(`/api/v1/orders/${orderId}/transitions`)
        .set(auth(ownerTok))
        .send({ action });
      expect(res.status).toBe(200);
    }
    const final = await request(app).get(`/api/v1/orders/${orderId}`).set(auth(ownerTok));
    expect(final.body.order.status).toBe('COLLECTED');
    expect(final.body.order.accepted_at).toBeTruthy();
    expect(final.body.order.collected_at).toBeTruthy();

    const history = await db('order_status_history').where({ order_id: orderId }).orderBy('created_at');
    expect(history.map((h) => h.to_status)).toEqual([
      'PENDING_ACCEPTANCE',
      'ACCEPTED',
      'READY_FOR_PICKUP',
      'COLLECTED',
    ]);
  });

  it('cannot transition a terminal (COLLECTED) order', async () => {
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/transitions`)
      .set(auth(ownerTok))
      .send({ action: 'ready' });
    expect(res.status).toBe(409);
  });

  it('lazily expires a stale PENDING order — same verdict for shopper and shopkeeper', async () => {
    const [stale] = await db('orders')
      .insert({
        order_code: 'STAL',
        user_id: shopperId,
        shop_id: shopId,
        status: 'PENDING_ACCEPTANCE',
        idempotency_key: `k-${tag}-stale`,
        subtotal_amount: 60,
        pending_acceptance_at: db.raw("now() - interval '10 minutes'"),
        created_at: db.raw("now() - interval '10 minutes'"),
      })
      .returning('id');

    const mine = await request(app).get('/api/v1/orders/mine').set(auth(shopperTok));
    const queue = await request(app).get(`/api/v1/shops/${slug}/orders`).set(auth(ownerTok));
    const inMine = mine.body.orders.find((o) => o.id === stale.id);
    const inQueue = queue.body.orders.find((o) => o.id === stale.id);
    expect(inMine.status).toBe('EXPIRED');
    expect(inQueue.status).toBe('EXPIRED');

    const hist = await db('order_status_history')
      .where({ order_id: stale.id, to_status: 'EXPIRED', changed_by: 'system' })
      .first();
    expect(hist).toBeTruthy();
  });

  it('a rejection still succeeds even though SMS is not configured (best-effort)', async () => {
    const [o] = await db('orders')
      .insert({
        order_code: 'REJ1',
        user_id: shopperId,
        shop_id: shopId,
        status: 'PENDING_ACCEPTANCE',
        idempotency_key: `k-${tag}-rej`,
        subtotal_amount: 60,
        pending_acceptance_at: db.fn.now(),
      })
      .returning('id');
    const res = await request(app)
      .post(`/api/v1/orders/${o.id}/transitions`)
      .set(auth(ownerTok))
      .send({ action: 'reject', reason: 'Out of stock' });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('REJECTED');
    expect(res.body.order.rejection_reason).toBe('Out of stock');
  });
});
