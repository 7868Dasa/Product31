/**
 * Structured logger. Redacts anything that could leak PII / secrets (spec §8:
 * "never log OTP codes or full phone numbers in plaintext").
 */
import pino from 'pino';
import { config, isProd } from '../config.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.otp',
  '*.otp_code',
  '*.otp_hash',
  '*.password',
  '*.access_token',
  '*.refresh_token',
  '*.token',
  '*.JWT_ACCESS_SECRET',
  '*.JWT_REFRESH_SECRET',
  '*.OTP_PEPPER',
  '*.MSG91_AUTH_KEY',
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  redact: { paths: redactPaths, censor: '[redacted]' },
  transport: isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
  base: { env: config.NODE_ENV },
});

/** Mask a phone number for logs: +919876543210 -> +9198****3210 */
export function maskPhone(phone) {
  if (!phone || phone.length < 6) return '****';
  return `${phone.slice(0, 4)}****${phone.slice(-4)}`;
}
