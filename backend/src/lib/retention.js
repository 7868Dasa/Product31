/**
 * Data-retention sweeps (DPDP retention limitation + CERT-In 180-day minimum).
 * Pure functions — wire them into the background-job runner at build step 4.
 *
 *   OTPs            purged 24h after creation (short-lived by nature)
 *   security_events kept >= 400 days (CERT-In wants >= 180; we keep a margin)
 *   deletion_requests kept 3 years as an erasure audit trail
 */
import { db } from '../db.js';
import { logger } from './logger.js';

const DAY = 24 * 60 * 60 * 1000;

export async function purgeExpiredOtps({ olderThanMs = DAY } = {}) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const n = await db('otp_verifications').where('created_at', '<', cutoff).del();
  if (n) logger.info({ n }, 'retention: purged OTP records');
  return n;
}

export async function purgeOldSecurityEvents({ keepDays = 400 } = {}) {
  const cutoff = new Date(Date.now() - keepDays * DAY);
  const n = await db('security_events').where('created_at', '<', cutoff).del();
  if (n) logger.info({ n }, 'retention: purged security events');
  return n;
}

export async function purgeOldDeletionRequests({ keepDays = 1095 } = {}) {
  const cutoff = new Date(Date.now() - keepDays * DAY);
  const n = await db('deletion_requests').where('requested_at', '<', cutoff).del();
  if (n) logger.info({ n }, 'retention: purged deletion requests');
  return n;
}

export async function runRetentionSweep() {
  return {
    otps: await purgeExpiredOtps(),
    security_events: await purgeOldSecurityEvents(),
    deletion_requests: await purgeOldDeletionRequests(),
  };
}
