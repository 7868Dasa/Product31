/**
 * 0011 — `shops.auto_confirm`: the shop accepts incoming orders automatically.
 *
 * When true, a placed order skips the manual "Accept" step and lands straight
 * in ACCEPTED (system actor, logged in order_status_history). The shop still
 * marks READY and COLLECTED by hand — this only removes the confirm gate so
 * the shopper isn't left waiting. Default false (manual, as today).
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('shops', (t) => {
    t.boolean('auto_confirm').notNullable().defaultTo(false);
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('shops', (t) => {
    t.dropColumn('auto_confirm');
  });
}
