/**
 * 0007 — one-time ₹29 unlock for the shopper spending-report PDF.
 *
 * A `status='paid'` row means the user has unlocked the PDF. Real payments go
 * through a gateway (Razorpay/Cashfree/PhonePe) that holds the PA licence —
 * we only ever store its reference and the GST-invoice fields, never card
 * data. See docs/COMPLIANCE.md §6.
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.createTable('report_purchases', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('amount_inr').notNullable().defaultTo(29);
    t.string('currency', 3).notNullable().defaultTo('INR');
    t.string('gateway').nullable(); // 'razorpay' | 'stub'
    t.string('gateway_order_ref').nullable();
    t.string('gateway_payment_ref').nullable();
    t.string('invoice_no').nullable(); // GST invoice number, issued on 'paid'
    t.string('status').notNullable().defaultTo('created'); // created | paid | failed | refunded
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('paid_at', { useTz: true }).nullable();
    t.index(['user_id', 'status'], 'report_purchases_user_idx');
    t.check(
      "status in ('created','paid','failed','refunded')",
      [],
      'report_purchases_status_check',
    );
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('report_purchases');
}
