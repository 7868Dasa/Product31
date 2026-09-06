/**
 * Security / auth audit log (spec §8, CERT-In). Every auth-relevant action
 * lands in `security_events`. Never stores OTP codes or full phone numbers —
 * the phone is masked here before insert.
 *
 * Audit failure must never break the request path: errors are logged, not
 * thrown.
 */
import { db } from '../db.js';
import { logger, maskPhone } from './logger.js';

/**
 * @param {{
 *   eventType: string,          // 'otp.requested' | 'otp.verified' | 'auth.login' | ...
 *   userId?: string | null,
 *   phone?: string | null,      // masked before insert
 *   ip?: string | null,
 *   userAgent?: string | null,
 *   outcome?: 'success' | 'failure' | 'rate_limited',
 *   detail?: string | object | null,
 * }} e
 */
export async function recordSecurityEvent(e) {
  try {
    await db('security_events').insert({
      event_type: e.eventType,
      user_id: e.userId ?? null,
      phone_masked: e.phone ? maskPhone(e.phone) : null,
      ip: e.ip || null,
      user_agent: e.userAgent ? String(e.userAgent).slice(0, 255) : null,
      outcome: e.outcome || 'success',
      detail:
        e.detail == null ? null : typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail),
    });
  } catch (err) {
    logger.error({ err, eventType: e.eventType }, 'failed to record security event');
  }
}
