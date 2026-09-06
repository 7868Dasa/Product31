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
