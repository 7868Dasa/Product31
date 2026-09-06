/**
 * 0001 — initial schema. Covers every core table in spec §4, plus:
 *   - refresh_tokens          (spec §8: revocable refresh tokens)
 *   - shops.owner_user_id     (spec §8: ownership checks)
 *   - otp_verifications.otp_hash instead of otp_code (spec §8: no plaintext)
 *   - set_updated_at() trigger on every table with updated_at
 * See docs/ARCHITECTURE.md for the rationale on each deviation.
 *
 * No `role` column on users and no delivery-partner tables/fields — that role
 * is Phase 2 (spec §1).
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.raw('create extension if not exists pgcrypto');

  await knex.raw(`
    create or replace function set_updated_at() returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql;
  `);

  const withUpdatedAtTrigger = async (table) => {
    await knex.raw(`
      drop trigger if exists trg_${table}_updated_at on ${table};
      create trigger trg_${table}_updated_at before update on ${table}
      for each row execute function set_updated_at();
    `);
  };

  // ── users ──────────────────────────────────────────────────────────────
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('phone_number').notNullable().unique();
    t.string('email').nullable();
    t.string('full_name').nullable();
    t.string('area').nullable();
    t.decimal('latitude', 10, 7).nullable();
    t.decimal('longitude', 10, 7).nullable();
    t.boolean('is_phone_verified').notNullable().defaultTo(false);
    t.integer('no_show_count').notNullable().defaultTo(0);
    t.string('status').notNullable().defaultTo('active'); // active | suspended
    t.string('fcm_token').nullable();
    t.string('preferred_language', 2).notNullable().defaultTo('en'); // 'en' | 'ta'
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.check("preferred_language in ('en','ta')", [], 'users_preferred_language_check');
    t.check("status in ('active','suspended')", [], 'users_status_check');
  });
  await withUpdatedAtTrigger('users');

  // ── shops ──────────────────────────────────────────────────────────────
  await knex.schema.createTable('shops', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('owner_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('owner_name').nullable();
    t.string('shop_name').notNullable();
    t.string('phone_number').notNullable(); // shop's public contact, may differ from owner login
    t.string('category').nullable();
    t.text('address').nullable();
    t.decimal('latitude', 10, 7).nullable();
    t.decimal('longitude', 10, 7).nullable();
    t.boolean('is_open').notNullable().defaultTo(true);
    t.integer('acceptance_sla_minutes').notNullable().defaultTo(5);
    t.integer('pickup_hold_minutes').notNullable().defaultTo(90);
    t.string('slug', 16).notNullable().unique(); // random, non-sequential (spec §4/§8)
    t.timestamp('qr_generated_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['latitude', 'longitude'], 'shops_lat_lng_idx');
    t.index('owner_user_id', 'shops_owner_idx');
  });
  await withUpdatedAtTrigger('shops');

  // ── master_products (central catalog, spec §5) ─────────────────────────
  await knex.schema.createTable('master_products', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.string('name_ta').nullable(); // Tamil-script name (spec §9)
    t.string('brand').nullable();
    t.string('category').nullable();
    t.string('unit').nullable(); // g | kg | ml | l | pcs ...
    t.string('variant_group').nullable(); // links pack-size variants of one base product (spec §9.2)
    t.string('pack_size').nullable(); // "50g" | "100g" | "1kg"
    t.string('icon').nullable();
    t.string('image_url').nullable();
    t.string('thumb_url').nullable();
    t.string('image_source').nullable(); // 'openfoodfacts' | 'shop_upload' | 'manual'
    t.string('barcode').nullable().unique();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index('variant_group', 'master_products_variant_group_idx');
    t.index('category', 'master_products_category_idx');
  });
  await withUpdatedAtTrigger('master_products');

  // ── shop_inventory ────────────────────────────────────────────────────
  await knex.schema.createTable('shop_inventory', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('shop_id').notNullable().references('id').inTable('shops').onDelete('CASCADE');
    t.uuid('product_id').notNullable().references('id').inTable('master_products').onDelete('RESTRICT');
    t.decimal('price', 10, 2).notNullable();
    t.integer('stock_qty').notNullable().defaultTo(0);
    t.boolean('is_available').notNullable().defaultTo(true);
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['shop_id', 'product_id']);
    t.check('stock_qty >= 0', [], 'shop_inventory_stock_qty_nonneg');
    t.check('price >= 0', [], 'shop_inventory_price_nonneg');
  });
  await withUpdatedAtTrigger('shop_inventory');

  // ── orders ────────────────────────────────────────────────────────────
  await knex.schema.createTable('orders', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('order_code').notNullable().unique();
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.uuid('shop_id').notNullable().references('id').inTable('shops').onDelete('RESTRICT');
    t.string('status').notNullable().defaultTo('CREATED');
    t.string('idempotency_key').notNullable().unique();
    t.decimal('subtotal_amount', 10, 2).notNullable().defaultTo(0);
    t.string('payment_method').notNullable().defaultTo('COD');
    t.string('rejection_reason').nullable();
    t.decimal('distance_km', 6, 2).nullable();
    t.integer('estimated_kcal').nullable();
    // one timestamp per state transition (spec §4)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('pending_acceptance_at', { useTz: true }).nullable();
    t.timestamp('accepted_at', { useTz: true }).nullable();
    t.timestamp('rejected_at', { useTz: true }).nullable();
    t.timestamp('expired_at', { useTz: true }).nullable();
    t.timestamp('ready_at', { useTz: true }).nullable();
    t.timestamp('collected_at', { useTz: true }).nullable();
    t.timestamp('no_show_at', { useTz: true }).nullable();
    t.timestamp('pickup_slot_start', { useTz: true }).nullable();
    t.timestamp('pickup_slot_end', { useTz: true }).nullable();
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.check(
      "status in ('CREATED','PENDING_ACCEPTANCE','ACCEPTED','READY_FOR_PICKUP','COLLECTED','REJECTED','EXPIRED','NO_SHOW')",
      [],
      'orders_status_check',
    );
    t.check("payment_method in ('COD')", [], 'orders_payment_method_check');
    t.index(['shop_id', 'status'], 'orders_shop_status_idx');
    t.index(['user_id', 'created_at'], 'orders_user_created_idx');
    t.index('status', 'orders_status_idx');
  });
  await withUpdatedAtTrigger('orders');

  // ── order_items ───────────────────────────────────────────────────────
  await knex.schema.createTable('order_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.uuid('product_id').nullable().references('id').inTable('master_products').onDelete('SET NULL');
    t.string('product_name').notNullable(); // snapshot
    t.integer('quantity').notNullable();
    t.decimal('unit_price', 10, 2).notNullable(); // snapshot
    t.decimal('line_total', 10, 2).notNullable();
    t.check('quantity > 0', [], 'order_items_quantity_pos');
    t.index('order_id', 'order_items_order_idx');
  });

  // ── order_status_history (audit trail, spec §3/§4) ────────────────────
  await knex.schema.createTable('order_status_history', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.string('from_status').nullable();
    t.string('to_status').notNullable();
    t.string('changed_by').nullable(); // 'system' | 'user:<id>' | 'shop:<id>'
    t.string('note').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['order_id', 'created_at'], 'order_status_history_order_idx');
  });

  // ── wishlist_items ────────────────────────────────────────────────────
  await knex.schema.createTable('wishlist_items', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('shop_inventory_id')
      .notNullable()
      .references('id')
      .inTable('shop_inventory')
      .onDelete('CASCADE');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.unique(['user_id', 'shop_inventory_id']);
  });

  // ── notifications ────────────────────────────────────────────────────
  await knex.schema.createTable('notifications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('recipient_type').notNullable(); // 'user' | 'shop'
    t.uuid('recipient_id').notNullable();
    t.uuid('order_id').nullable().references('id').inTable('orders').onDelete('CASCADE');
    t.string('event_type').notNullable();
    t.string('channel').notNullable(); // 'push' | 'email'
    t.string('title').nullable();
    t.text('body').nullable();
    t.timestamp('sent_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.check("recipient_type in ('user','shop')", [], 'notifications_recipient_type_check');
    t.check("channel in ('push','email')", [], 'notifications_channel_check');
    t.index(['recipient_type', 'recipient_id'], 'notifications_recipient_idx');
  });

  // ── otp_verifications ────────────────────────────────────────────────
  await knex.schema.createTable('otp_verifications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('phone_number').notNullable();
    t.string('otp_hash').notNullable(); // HMAC-SHA-256, never the plaintext (spec §8)
    t.string('purpose').notNullable().defaultTo('login'); // login | onboarding (same mechanism)
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.boolean('is_used').notNullable().defaultTo(false);
    t.integer('attempt_count').notNullable().defaultTo(0);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['phone_number', 'created_at'], 'otp_phone_created_idx');
  });

  // ── refresh_tokens (spec §8) ────────────────────────────────────────
  await knex.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('token_hash', 64).notNullable().unique(); // sha-256 hex
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('revoked_at', { useTz: true }).nullable();
    t.string('user_agent').nullable();
    t.string('ip').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id'], 'refresh_tokens_user_idx');
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('otp_verifications');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('wishlist_items');
  await knex.schema.dropTableIfExists('order_status_history');
  await knex.schema.dropTableIfExists('order_items');
  await knex.schema.dropTableIfExists('orders');
  await knex.schema.dropTableIfExists('shop_inventory');
  await knex.schema.dropTableIfExists('master_products');
  await knex.schema.dropTableIfExists('shops');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('drop function if exists set_updated_at()');
}
