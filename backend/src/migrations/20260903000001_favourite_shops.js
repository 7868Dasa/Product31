/**
 * 0009 — a shopper's favourite shops ("My shops").
 *
 * The whole model is "your regular shops": a shopper scans a QR once, then
 * wants back in without re-scanning or searching. One row per (user, shop).
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('favourite_shops', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['user_id', 'shop_id']);
    t.index('user_id', 'favourite_shops_user_idx');
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('favourite_shops');
}
