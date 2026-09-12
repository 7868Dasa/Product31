/**
 * SMS delivery for OTP. Mock in local dev; MSG91 in production (spec §12).
 *
 * The one deliberately non-free piece. MSG91 also needs DLT / sender-ID
 * registration done out-of-band before it works — see docs/ARCHITECTURE.md.
 */
import { config, isProd } from '../config.js';
import { logger, maskPhone } from './logger.js';

/**
 * @param {string} phone  E.164 phone number
 * @param {string} code   the plaintext OTP (never logged)
 * @returns {Promise<{ channel: 'mock' | 'msg91', delivered: boolean }>}
 */
export async function sendOtpSms(phone, code) {
  if (config.OTP_MOCK && !isProd) {
    logger.info({ phone: maskPhone(phone) }, 'OTP (mock) generated — code returned in API response');
    return { channel: 'mock', delivered: true };
  }

  if (!config.MSG91_AUTH_KEY || !config.MSG91_TEMPLATE_ID) {
    // Do not silently pretend to send. (working rules: no fake placeholders)
    throw new Error('MSG91 is not configured (MSG91_AUTH_KEY / MSG91_TEMPLATE_ID missing)');
  }

  const res = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey: config.MSG91_AUTH_KEY },
    body: JSON.stringify({
      template_id: config.MSG91_TEMPLATE_ID,
      mobile: phone.replace(/^\+/, ''),
      sender: config.MSG91_SENDER_ID || undefined,
      otp: code,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error({ phone: maskPhone(phone), status: res.status, body: text }, 'MSG91 send failed');
    throw new Error(`MSG91 responded ${res.status}`);
  }
  return { channel: 'msg91', delivered: true };
}

/**
 * Tell a shopper their order was rejected. This is the ONE status change that
 * costs a wasted trip if they don't see it in the app — accept / ready / ready
 * they'll notice when they open the app to walk over (see plan-eng-review Q3).
 *
 * Best-effort: never throws, never blocks the REJECTED transition. Never logs
 * the phone in full or the message body (spec §8 / DPDP).
 *
 * @param {string} phone      E.164 shopper phone
 * @param {{ order_code: string, shop_name: string, reason?: string }} order
 * @returns {Promise<{ channel: 'mock' | 'msg91' | 'skipped', delivered: boolean }>}
 */
export async function sendRejectionSms(phone, order) {
  try {
    if (!phone) return { channel: 'skipped', delivered: false };

    if (config.OTP_MOCK && !isProd) {
      logger.info(
        { phone: maskPhone(phone), order_code: order.order_code },
        'rejection SMS (mock) — not actually sent',
      );
      return { channel: 'mock', delivered: true };
    }

    if (!config.MSG91_AUTH_KEY || !config.MSG91_REJECT_TEMPLATE_ID) {
      logger.warn(
        { order_code: order.order_code },
        'rejection SMS skipped — MSG91_REJECT_TEMPLATE_ID not configured',
      );
      return { channel: 'skipped', delivered: false };
    }

    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: config.MSG91_AUTH_KEY },
      body: JSON.stringify({
        template_id: config.MSG91_REJECT_TEMPLATE_ID,
        sender: config.MSG91_SENDER_ID || undefined,
        recipients: [
          {
            mobiles: phone.replace(/^\+/, ''),
            // DLT template vars — kept minimal, no PII beyond the shop name.
            // Must match the variable slots on the registered MSG91_REJECT_TEMPLATE_ID.
            code: order.order_code,
            shop: order.shop_name,
            reason: order.reason || '',
          },
        ],
      }),
    });

    if (!res.ok) {
      logger.error(
        { phone: maskPhone(phone), status: res.status, order_code: order.order_code },
        'rejection SMS send failed',
      );
      return { channel: 'msg91', delivered: false };
    }
    return { channel: 'msg91', delivered: true };
  } catch (err) {
    logger.error({ err, order_code: order && order.order_code }, 'rejection SMS threw — ignored');
    return { channel: 'skipped', delivered: false };
  }
}
