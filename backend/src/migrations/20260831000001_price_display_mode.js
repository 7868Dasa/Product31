/**
 * 0003 — per-shop price display mode. The shopkeeper decides how prices show
 * to shoppers for their own shop:
 *   'exact'  — show ₹ price per item (default)
 *   'range'  — show a rounded band instead of the exact number
 *   'hidden' — don't publish prices; shopper pays at the counter
 *
 * This is a shop-scoped setting, not a cross-shop comparison surface, so it
 * does not conflict with the permanent "no price comparison" rule (spec §1).
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('shops', (t) => {
    t.string('price_display_mode').notNullable().defaultTo('exact');
  });
  await knex.raw(
    `alter table shops add constraint shops_price_display_mode_check
     check (price_display_mode in ('exact','range','hidden'))`,
  );
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw('alter table shops drop constraint if exists shops_price_display_mode_check');
  await knex.schema.alterTable('shops', (t) => {
    t.dropColumn('price_display_mode');
  });
}
