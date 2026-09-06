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
import { recordSecurityEvent } from '../../lib/audit.js';
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
  'consent_version',
  'location_consent',
  'marketing_consent',
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

export async function requestOtp({ phone_number, purpose }, ctx = {}) {
  try {
    await assertRequestRateOk(phone_number);
  } catch (err) {
    await recordSecurityEvent({
      eventType: 'otp.requested',
      phone: phone_number,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      outcome: 'rate_limited',
      detail: { purpose },
    });
    throw err;
  }

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
    await recordSecurityEvent({
      eventType: 'otp.send_failed',
      phone: phone_number,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      outcome: 'failure',
    });
    throw badRequest('OTP_SEND_FAILED', 'Could not send the code right now. Please try again.');
  }

  logger.info({ phone: maskPhone(phone_number), purpose, channel }, 'OTP issued');
  await recordSecurityEvent({
    eventType: 'otp.requested',
    phone: phone_number,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    detail: { purpose, channel },
  });

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

  const fail = async (code, msg, { outcome = 'failure', status = 400 } = {}) => {
    await recordSecurityEvent({
      eventType: 'otp.verify_failed',
      phone: phone_number,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      outcome,
      detail: { code },
    });
    return status === 429
      ? tooManyRequests(code, msg)
      : badRequest(code, msg);
  };

  if (!record) throw await fail('OTP_NOT_FOUND', 'Request a new code.');

  if (new Date(record.expires_at).getTime() < Date.now()) {
    throw await fail('OTP_EXPIRED', 'That code has expired. Request a new one.');
  }

  if (record.attempt_count >= config.OTP_MAX_VERIFY_ATTEMPTS) {
    // burn it so it can't be brute-forced further (spec §8)
    await db('otp_verifications').where({ id: record.id }).update({ is_used: true });
    throw await fail('OTP_ATTEMPTS_EXCEEDED', 'Too many wrong attempts. Request a new code.', {
      outcome: 'rate_limited',
      status: 429,
    });
  }

  if (!otpMatches(otp_code, record.otp_hash)) {
    await db('otp_verifications').where({ id: record.id }).increment('attempt_count', 1);
    throw await fail('OTP_INVALID', 'That code is not correct.');
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
  await recordSecurityEvent({
    eventType: isNewUser ? 'auth.signup' : 'auth.login',
    userId: user.id,
    phone: phone_number,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
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
    await recordSecurityEvent({
      eventType: 'token.refresh_invalid',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      outcome: 'failure',
    });
    throw unauthorized('REFRESH_INVALID', 'Please sign in again.');
  }

  const user = await db('users').where({ id: row.user_id }).first();
  if (!user || user.status !== 'active') {
    await recordSecurityEvent({
      eventType: 'token.refresh_invalid',
      userId: row.user_id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      outcome: 'failure',
      detail: { reason: user ? user.status : 'user_gone' },
    });
    throw unauthorized('REFRESH_INVALID', 'Please sign in again.');
  }

  await db('refresh_tokens').where({ id: row.id }).update({ revoked_at: db.fn.now() });
  const tokens = await issueTokens(user, ctx);
  await recordSecurityEvent({
    eventType: 'token.refreshed',
    userId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return { ...tokens, user: publicUser(user) };
}

export async function revokeRefreshToken(rawToken, ctx = {}) {
  const hash = hashRefreshToken(rawToken);
  const row = await db('refresh_tokens').where({ token_hash: hash }).first();
  await db('refresh_tokens')
    .where({ token_hash: hash })
    .andWhere({ revoked_at: null })
    .update({ revoked_at: db.fn.now() });
  await recordSecurityEvent({
    eventType: 'auth.logout',
    userId: row?.user_id ?? null,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}
