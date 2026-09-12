/**
 * 0012 — partial fulfilment (spec follow-up #5, Option A). While packing an
 * ACCEPTED order the shop can flag specific lines as out of stock; the order
 * moves to PENDING_CONFIRMATION and the shopper must explicitly confirm the
 * reduced order (back to ACCEPTED) or cancel it (CANCELLED) — the shop can
 * never silently substitute or reduce what was agreed.
 *
 * order_items.unavailable marks which lines were dropped, so the shopper's
 * confirmation screen and the receipt can show exactly what changed.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('orders', (t) => {
    t.timestamp('flagged_at', { useTz: true }).nullable();
    t.timestamp('confirmed_at', { useTz: true }).nullable();
    t.timestamp('cancelled_at', { useTz: true }).nullable();
  });
  await knex.raw('alter table orders drop constraint if exists orders_status_check');
  await knex.raw(
    `alter table orders add constraint orders_status_check
     check (status in ('CREATED','PENDING_ACCEPTANCE','ACCEPTED','PENDING_CONFIRMATION',
                        'READY_FOR_PICKUP','COLLECTED','REJECTED','EXPIRED','NO_SHOW','CANCELLED'))`,
  );

  await knex.schema.alterTable('order_items', (t) => {
    t.boolean('unavailable').notNullable().defaultTo(false);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('order_items', (t) => {
    t.dropColumn('unavailable');
  });

  await knex.raw('alter table orders drop constraint if exists orders_status_check');
  await knex.raw(
    `alter table orders add constraint orders_status_check
     check (status in ('CREATED','PENDING_ACCEPTANCE','ACCEPTED','READY_FOR_PICKUP',
                        'COLLECTED','REJECTED','EXPIRED','NO_SHOW'))`,
  );
  await knex.schema.alterTable('orders', (t) => {
    t.dropColumn('flagged_at');
    t.dropColumn('confirmed_at');
    t.dropColumn('cancelled_at');
  });
}
