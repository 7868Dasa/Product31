/**
 * Auth domain logic: OTP issue/verify with durable per-phone rate limits
 * (spec §8), JWT issue, refresh-token rotation & revocation.
 */
import { db } from '../../db.js';
import { config } from '../../config.js';
import { logger, maskPhone } from '../../lib/logger.js';
import { badRequest, tooManyRequests, unauthorized } from '../../lib/errors.js';
import { hashOtp, otpMatches } from '../../lib/otp.js';
import { newOtpCode } from '../../lib/ids.js';
import { sendOtpSms } from '../../lib/sms.js';
import {
  signAccessToken,
  createRefreshToken,
  hashRefreshToken,
  ttlToMs,
} from '../../lib/jwt.js';

const PUBLIC_USER_COLUMNS = [
  'id',
  'phone_number',
  'email',
  'full_name',
  'area',
  'latitude',
  'longitude',
  'is_phone_verified',
  'preferred_language',
  'status',
  'created_at',
];

export function publicUser(row) {
  if (!row) return null;
  const out = {};
  for (const c of PUBLIC_USER_COLUMNS) out[c] = row[c];
  return out;
}

/** spec §8: max OTP_MAX_REQUESTS_PER_WINDOW requests per phone per window. */
async function assertRequestRateOk(phone) {
  const since = new Date(Date.now() - config.OTP_REQUEST_WINDOW_SECONDS * 1000);
  const [{ count }] = await db('otp_verifications')
    .where({ phone_number: phone })
    .andWhere('created_at', '>=', since)
    .count({ count: '*' });
  if (Number(count) >= config.OTP_MAX_REQUESTS_PER_WINDOW) {
    throw tooManyRequests('OTP_REQUESTS_EXCEEDED', 'Too many code requests. Try again later.', {
      retry_after_seconds: config.OTP_REQUEST_WINDOW_SECONDS,
    });
  }
}

export async function requestOtp({ phone_number, purpose }) {
  await assertRequestRateOk(phone_number);

  const code = newOtpCode(6);
  const expiresAt = new Date(Date.now() + config.OTP_TTL_SECONDS * 1000);

  const [row] = await db('otp_verifications')
    .insert({
      phone_number,
      otp_hash: hashOtp(code),
      purpose,
      expires_at: expiresAt,
    })
    .returning(['id', 'expires_at']);

  let channel = 'mock';
  try {
    ({ channel } = await sendOtpSms(phone_number, code));
  } catch (err) {
    logger.error({ err, phone: maskPhone(phone_number) }, 'OTP send failed');
    throw badRequest('OTP_SEND_FAILED', 'Could not send the code right now. Please try again.');
  }

  logger.info({ phone: maskPhone(phone_number), purpose, channel }, 'OTP issued');

  return {
    request_id: row.id,
    expires_at: row.expires_at,
    // Dev convenience only — real SMS never returns the code.
    ...(config.OTP_MOCK && config.NODE_ENV !== 'production' ? { dev_otp: code } : {}),
  };
}

export async function verifyOtp({ phone_number, otp_code }, ctx = {}) {
  const record = await db('otp_verifications')
    .where({ phone_number, is_used: false })
    .orderBy('created_at', 'desc')
    .first();

  if (!record) throw badRequest('OTP_NOT_FOUND', 'Request a new code.');

  if (new Date(record.expires_at).getTime() < Date.now()) {
    throw badRequest('OTP_EXPIRED', 'That code has expired. Request a new one.');
  }

  if (record.attempt_count >= config.OTP_MAX_VERIFY_ATTEMPTS) {
    // burn it so it can't be brute-forced further (spec §8)
    await db('otp_verifications').where({ id: record.id }).update({ is_used: true });
    throw tooManyRequests('OTP_ATTEMPTS_EXCEEDED', 'Too many wrong attempts. Request a new code.');
  }

  if (!otpMatches(otp_code, record.otp_hash)) {
    await db('otp_verifications').where({ id: record.id }).increment('attempt_count', 1);
    throw badRequest('OTP_INVALID', 'That code is not correct.');
  }

  // success — consume the OTP
  await db('otp_verifications').where({ id: record.id }).update({ is_used: true });

  // upsert the user
  const existing = await db('users').where({ phone_number }).first();
  let user = existing;
  let isNewUser = false;
  if (!existing) {
    [user] = await db('users')
      .insert({ phone_number, is_phone_verified: true })
      .returning('*');
    isNewUser = true;
  } else if (!existing.is_phone_verified) {
    [user] = await db('users')
      .where({ id: existing.id })
      .update({ is_phone_verified: true })
      .returning('*');
  }

  const tokens = await issueTokens(user, ctx);
  return { ...tokens, user: publicUser(user), is_new_user: isNewUser };
}

export async function issueTokens(user, ctx = {}) {
  const access_token = signAccessToken(user);
  const { raw, hash } = createRefreshToken();
  const expiresAt = new Date(Date.now() + ttlToMs(config.JWT_REFRESH_TTL));

  await db('refresh_tokens').insert({
    user_id: user.id,
    token_hash: hash,
    expires_at: expiresAt,
    user_agent: ctx.userAgent?.slice(0, 255) ?? null,
    ip: ctx.ip ?? null,
  });

  return {
    access_token,
    refresh_token: raw,
    token_type: 'Bearer',
    expires_in: Math.floor(ttlToMs(config.JWT_ACCESS_TTL) / 1000),
  };
}

/** Rotate: the presented refresh token is revoked and a fresh pair issued. */
export async function rotateRefreshToken(rawToken, ctx = {}) {
  const hash = hashRefreshToken(rawToken);
  const row = await db('refresh_tokens').where({ token_hash: hash }).first();

  if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
    throw unauthorized('REFRESH_INVALID', 'Please sign in again.');
  }

  const user = await db('users').where({ id: row.user_id }).first();
  if (!user || user.status !== 'active') {
    throw unauthorized('REFRESH_INVALID', 'Please sign in again.');
  }

  await db('refresh_tokens').where({ id: row.id }).update({ revoked_at: db.fn.now() });
  const tokens = await issueTokens(user, ctx);
  return { ...tokens, user: publicUser(user) };
}

export async function revokeRefreshToken(rawToken) {
  const hash = hashRefreshToken(rawToken);
  await db('refresh_tokens')
    .where({ token_hash: hash })
    .andWhere({ revoked_at: null })
    .update({ revoked_at: db.fn.now() });
}
