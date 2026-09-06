/**
 * 0005 — variable net weight (plan-eng-review scope C).
 *
 * A product's size isn't one fixed string. The SAME "Toor Dal" is sold
 * pre-packed at a supermarket and loose by the kg at the kirana next door, so
 * "how it's sold" belongs on `shop_inventory`, not `master_products`.
 *
 *   sell_by = 'pack'   → discrete units; quantity is a count       (Aavin Milk 500ml ×2)
 *   sell_by = 'weight' → loose; quantity is a numeric amount        (Toor Dal 0.75 kg)
 *   sell_by = 'piece'  → per item, actual weight varies             (Coconut ×3)
 *
 * Quantities become `numeric` everywhere (0.75 kg is real). `pack_size` (the
 * free string) is kept one release as a display fallback; 0007 drops it after
 * `net_weight_value` / `net_weight_unit` are backfilled and trusted.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  // ── master_products: identity + a default hint ──────────────────────────
  await knex.schema.alterTable('master_products', (t) => {
    t.string('default_sell_by').notNullable().defaultTo('pack');
    t.decimal('net_weight_value', 10, 3).nullable(); // 50, 100, 1  (was "50g")
    t.string('net_weight_unit').nullable(); // g | kg | ml | l  — packaged only
    t.string('base_unit').notNullable().defaultTo('pcs'); // kg | l | pcs
  });
  await knex.raw(`
    alter table master_products
      add constraint master_products_default_sell_by_check
        check (default_sell_by in ('pack','weight','piece')),
      add constraint master_products_net_weight_unit_check
        check (net_weight_unit is null or net_weight_unit in ('g','kg','ml','l')),
      add constraint master_products_base_unit_check
        check (base_unit in ('kg','l','pcs'))
  `);
  // best-effort backfill from the legacy string
  await knex.raw(`
    update master_products set
      net_weight_value = nullif(regexp_replace(pack_size, '[^0-9.]', '', 'g'), '')::numeric,
      net_weight_unit  = lower(nullif(regexp_replace(pack_size, '[0-9.]', '', 'g'), ''))
    where pack_size ~ '^[0-9.]+ ?(g|kg|ml|l)$'
  `);

  // ── shop_inventory: how THIS shop sells it ─────────────────────────────
  await knex.schema.alterTable('shop_inventory', (t) => {
    t.renameColumn('stock_qty', 'stock_amount');
  });
  await knex.schema.alterTable('shop_inventory', (t) => {
    t.decimal('stock_amount', 12, 3).notNullable().defaultTo(0).alter();
    t.string('sell_by').notNullable().defaultTo('pack');
    t.string('price_basis').notNullable().defaultTo('per_pack');
    t.decimal('min_qty', 10, 3).nullable(); // weight: smallest sale (0.25)
    t.decimal('max_qty', 10, 3).nullable(); // weight: largest single sale (10)
    t.decimal('step_qty', 10, 3).nullable(); // weight: stepper granularity (0.25)
    t.decimal('est_unit_weight_g', 10, 1).nullable(); // piece: "≈ 1.2 kg" display
  });
  await knex.raw(`
    alter table shop_inventory
      drop constraint if exists shop_inventory_stock_qty_nonneg,
      add constraint shop_inventory_stock_amount_nonneg check (stock_amount >= 0),
      add constraint shop_inventory_sell_by_check
        check (sell_by in ('pack','weight','piece')),
      add constraint shop_inventory_price_basis_check
        check (price_basis in ('per_pack','per_kg','per_l','per_piece'))
  `);

  // ── order_items: an unambiguous snapshot for the counter ──────────────
  await knex.schema.alterTable('order_items', (t) => {
    t.decimal('quantity', 12, 3).notNullable().alter(); // was integer
    t.string('sell_by').nullable();
    t.string('unit').nullable(); // the unit `quantity` is in: pack | kg | l | pcs
    t.string('price_basis').nullable();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.alterTable('order_items', (t) => {
    t.dropColumn('sell_by');
    t.dropColumn('unit');
    t.dropColumn('price_basis');
    t.integer('quantity').notNullable().alter();
  });

  await knex.raw(`
    alter table shop_inventory
      drop constraint if exists shop_inventory_stock_amount_nonneg,
      drop constraint if exists shop_inventory_sell_by_check,
      drop constraint if exists shop_inventory_price_basis_check
  `);
  await knex.schema.alterTable('shop_inventory', (t) => {
    t.dropColumn('sell_by');
    t.dropColumn('price_basis');
    t.dropColumn('min_qty');
    t.dropColumn('max_qty');
    t.dropColumn('step_qty');
    t.dropColumn('est_unit_weight_g');
    t.integer('stock_amount').notNullable().defaultTo(0).alter();
  });
  await knex.schema.alterTable('shop_inventory', (t) => {
    t.renameColumn('stock_amount', 'stock_qty');
  });
  await knex.raw(
    `alter table shop_inventory add constraint shop_inventory_stock_qty_nonneg check (stock_qty >= 0)`,
  );

  await knex.raw(`
    alter table master_products
      drop constraint if exists master_products_default_sell_by_check,
      drop constraint if exists master_products_net_weight_unit_check,
      drop constraint if exists master_products_base_unit_check
  `);
  await knex.schema.alterTable('master_products', (t) => {
    t.dropColumn('default_sell_by');
    t.dropColumn('net_weight_value');
    t.dropColumn('net_weight_unit');
    t.dropColumn('base_unit');
  });
}
