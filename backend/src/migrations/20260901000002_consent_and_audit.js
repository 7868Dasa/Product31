/**
 * 0006 — DPDP consent + CERT-In security audit + account deletion.
 *
 *   users.consent_version / consent_at / location_consent / marketing_consent
 *     — current consent state; 'deleted' status + deleted_at for erasure
 *   user_consents   — append-only record of every consent grant/withdrawal
 *                     (DPDP: prove what was consented, when, which version)
 *   security_events — every auth-relevant action (CERT-In log retention)
 *   deletion_requests — audit trail of erasure requests
 */

/** @param {import('knex').Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable('users', (t) => {
    t.string('consent_version').nullable();
    t.timestamp('consent_at', { useTz: true }).nullable();
    t.boolean('location_consent').notNullable().defaultTo(false);
    t.boolean('marketing_consent').notNullable().defaultTo(false);
    t.timestamp('deleted_at', { useTz: true }).nullable();
  });
  await knex.raw(`alter table users drop constraint if exists users_status_check`);
  await knex.raw(
    `alter table users add constraint users_status_check check (status in ('active','suspended','deleted'))`,
  );

  await knex.schema.createTable('user_consents', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('consent_version').notNullable();
    t.string('purpose').notNullable(); // account | tos | privacy | location | marketing
    t.boolean('granted').notNullable();
    t.string('source').notNullable(); // signup | settings | withdrawal
    t.string('ip').nullable();
    t.string('user_agent').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'created_at'], 'user_consents_user_idx');
    t.check(
      "purpose in ('account','tos','privacy','location','marketing')",
      [],
      'user_consents_purpose_check',
    );
    t.check("source in ('signup','settings','withdrawal')", [], 'user_consents_source_check');
  });

  await knex.schema.createTable('security_events', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('event_type').notNullable(); // otp.requested, otp.verified, auth.login, token.refreshed, ...
    t.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('phone_masked').nullable(); // +9198****3210 — NEVER the full number (spec §8)
    t.string('ip').nullable();
    t.string('user_agent').nullable();
    t.string('outcome').notNullable().defaultTo('success'); // success | failure | rate_limited
    t.text('detail').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['event_type', 'created_at'], 'security_events_type_idx');
    t.index(['user_id', 'created_at'], 'security_events_user_idx');
    t.check("outcome in ('success','failure','rate_limited')", [], 'security_events_outcome_check');
  });

  await knex.schema.createTable('deletion_requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').nullable();
    t.string('phone_masked').nullable();
    t.string('status').notNullable().defaultTo('completed'); // pending | completed
    t.timestamp('requested_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('completed_at', { useTz: true }).nullable();
  });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists('deletion_requests');
  await knex.schema.dropTableIfExists('security_events');
  await knex.schema.dropTableIfExists('user_consents');
  await knex.raw(`alter table users drop constraint if exists users_status_check`);
  await knex.raw(
    `alter table users add constraint users_status_check check (status in ('active','suspended'))`,
  );
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('consent_version');
    t.dropColumn('consent_at');
    t.dropColumn('location_consent');
    t.dropColumn('marketing_consent');
    t.dropColumn('deleted_at');
  });
}
