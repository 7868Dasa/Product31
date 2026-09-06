/**
 * HTTP rate limiting (spec §8: "general API rate limiting", keep limits on
 * auth and write endpoints). In-memory store — fine for a single-process
 * pilot; swap for a Redis store when horizontally scaled.
 *
 * NOTE: the *per-phone* OTP request/verify limits in spec §8 are enforced
 * separately and durably in auth.service.js against the `otp_verifications`
 * table; this is the coarser per-IP guard.
 */
import rateLimit from 'express-rate-limit';

const json = (req, res) =>
  res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
  });

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json,
});

export const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json,
});
