/**
 * Account rights (DPDP): consent record, data export (access/portability),
 * account deletion (erasure). Every action is written to `security_events`.
 */
import { randomUUID } from 'node:crypto';
import { db } from '../../db.js';
import { conflict } from '../../lib/errors.js';
import { maskPhone } from '../../lib/logger.js';
import { recordSecurityEvent } from '../../lib/audit.js';
import { publicUser } from '../auth/auth.service.js';

export async function recordConsent(user, body, ctx) {
  await db.transaction(async (trx) => {
    await trx('users')
      .where({ id: user.id })
      .update({
        consent_version: body.consent_version,
        consent_at: trx.fn.now(),
        location_consent: !!body.location,
        marketing_consent: !!body.marketing,
      });

    const rows = [
      ['tos', true],
      ['privacy', true],
      ['account', true],
      ['location', !!body.location],
      ['marketing', !!body.marketing],
    ].map(([purpose, granted]) => ({
      user_id: user.id,
      consent_version: body.consent_version,
      purpose,
      granted,
      source: body.source,
      ip: ctx.ip || null,
      user_agent: ctx.userAgent ? String(ctx.userAgent).slice(0, 255) : null,
    }));
    await trx('user_consents').insert(rows);
  });

  await recordSecurityEvent({
    eventType: 'account.consent_recorded',
    userId: user.id,
    phone: user.phone_number,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    detail: {
      version: body.consent_version,
      location: !!body.location,
      marketing: !!body.marketing,
      source: body.source,
    },
  });

  const fresh = await db('users').where({ id: user.id }).first();
  return publicUser(fresh);
}

/** Everything we hold about this user, machine-readable (DPDP right to access). */
export async function exportData(user, ctx) {
  const [profile, consents, orders, wishlist, favourites, notifications, events] = await Promise.all([
    db('users').where({ id: user.id }).first(),
    db('user_consents').where({ user_id: user.id }).orderBy('created_at'),
    db('orders').where({ user_id: user.id }).orderBy('created_at'),
    db('wishlist_items').where({ user_id: user.id }),
    db('favourite_shops as f')
      .join('shops as s', 's.id', 'f.shop_id')
      .where('f.user_id', user.id)
      .select('s.slug', 's.shop_name', 'f.created_at'),
    db('notifications').where({ recipient_type: 'user', recipient_id: user.id }),
    db('security_events').where({ user_id: user.id }).orderBy('created_at').limit(1000),
  ]);
  const orderIds = orders.map((o) => o.id);
  const orderItems = orderIds.length
    ? await db('order_items').whereIn('order_id', orderIds)
    : [];

  await recordSecurityEvent({
    eventType: 'account.data_exported',
    userId: user.id,
    phone: user.phone_number,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  const p = profile || {};
  return {
    exported_at: new Date().toISOString(),
    profile: {
      id: p.id,
      phone_number: p.phone_number,
      email: p.email,
      full_name: p.full_name,
      area: p.area,
      latitude: p.latitude,
      longitude: p.longitude,
      is_phone_verified: p.is_phone_verified,
      preferred_language: p.preferred_language,
      status: p.status,
      consent_version: p.consent_version,
      consent_at: p.consent_at,
      location_consent: p.location_consent,
      marketing_consent: p.marketing_consent,
      created_at: p.created_at,
    },
    consents,
    orders,
    order_items: orderItems,
    wishlist,
    favourite_shops: favourites,
    notifications,
    security_events: events,
  };
}

/**
 * Erasure: scrub every PII field, keep the (now anonymous) row so order
 * foreign keys still resolve for the legally-required transaction-record
 * retention window. Revoke all sessions. Delete transient data outright.
 */
export async function deleteAccount(user, ctx) {
  const owned = await db('shops').where({ owner_user_id: user.id }).count({ c: '*' }).first();
  if (Number(owned.c) > 0) {
    throw conflict(
      'OWNS_SHOPS',
      'Close or transfer your shop(s) before deleting your account. Contact support.',
    );
  }

  const anonPhone = `deleted-${randomUUID()}`;
  await db.transaction(async (trx) => {
    await trx('refresh_tokens')
      .where({ user_id: user.id })
      .whereNull('revoked_at')
      .update({ revoked_at: trx.fn.now() });
    await trx('wishlist_items').where({ user_id: user.id }).del();
    await trx('favourite_shops').where({ user_id: user.id }).del();
    await trx('otp_verifications').where({ phone_number: user.phone_number }).del();
    await trx('notifications').where({ recipient_type: 'user', recipient_id: user.id }).del();
    await trx('users')
      .where({ id: user.id })
      .update({
        phone_number: anonPhone,
        email: null,
        full_name: null,
        area: null,
        latitude: null,
        longitude: null,
        fcm_token: null,
        is_phone_verified: false,
        status: 'deleted',
        deleted_at: trx.fn.now(),
        location_consent: false,
        marketing_consent: false,
      });
    await trx('deletion_requests').insert({
      user_id: user.id,
      phone_masked: maskPhone(user.phone_number),
      status: 'completed',
      completed_at: trx.fn.now(),
    });
  });

  await recordSecurityEvent({
    eventType: 'account.deleted',
    userId: user.id,
    phone: user.phone_number,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}
