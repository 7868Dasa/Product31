/**
 * 0008 — order code is unique per (shop, day), not globally.
 *
 * `order_code` is what the shopkeeper reads aloud at the counter ("order B4K9").
 * It only needs to be unique within one shop on one day. A global unique on a
 * short 4-char code piles up collisions as every shop's orders share one space;
 * scoping it to (shop_id, date) keeps the code short and readable forever.
 *
 * Also adds `pickup_slot_label` — a freeform "ASAP" / "5:30 PM" the shopper
 * picks at checkout. Pickup-only means no real scheduling; the timestamp
 * columns (pickup_slot_start/end) stay unused for now.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('orders', (t) => {
    t.dropUnique('order_code', 'orders_order_code_unique');
    t.string('pickup_slot_label').nullable();
  });

  // Expression index — knex has no builder for `(created_at::date)`.
  await knex.raw(`
    create unique index orders_shop_day_code_uidx
      on orders (shop_id, (created_at::date), order_code)
  `);
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw('drop index if exists orders_shop_day_code_uidx');
  await knex.schema.alterTable('orders', (t) => {
    t.dropColumn('pickup_slot_label');
    t.unique('order_code', 'orders_order_code_unique');
  });
}
