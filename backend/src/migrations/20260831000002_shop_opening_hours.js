/**
 * 0004 — `shops.opening_hours`. The onboarding form (spec §5) collects opening
 * hours; §4's table listing omitted the column. Free text for now
 * (e.g. "Mon-Sat 7:00-21:00, Sun 8:00-13:00"); a structured schedule can come
 * later if the dashboard needs to auto-open/close.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('shops', (t) => {
    t.string('opening_hours').nullable();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('shops', (t) => {
    t.dropColumn('opening_hours');
  });
}
