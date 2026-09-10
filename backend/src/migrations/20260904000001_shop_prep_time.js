/**
 * 0010 — `shops.prep_time_minutes`: the notice a shop wants before pickup.
 *
 * The shopkeeper SUGGESTS this ("order at least ~10 min ahead"); the shopper
 * DECIDES the actual pickup slot in the cart. Advisory in Phase 1 — shown to
 * the shopper and on the pickup ticket, not hard-enforced. Distinct from
 * `acceptance_sla_minutes` (time to accept) and `pickup_hold_minutes` (grace
 * before NO_SHOW).
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('shops', (t) => {
    t.integer('prep_time_minutes').notNullable().defaultTo(10);
  });
  await knex.raw(
    "alter table shops add constraint shops_prep_time_minutes_check check (prep_time_minutes between 0 and 120)",
  );
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.raw('alter table shops drop constraint if exists shops_prep_time_minutes_check');
  await knex.schema.alterTable('shops', (t) => {
    t.dropColumn('prep_time_minutes');
  });
}
