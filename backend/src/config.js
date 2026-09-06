/**
 * Central config. Reads process.env (populated by `node --env-file=.env`),
 * validates it, and fails fast on missing / unsafe values.
 */
import { z } from 'zod';

const bool = (def) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null ? def : /^(1|true|yes|on)$/i.test(v)));

const int = (def) =>
  z
    .string()
    .optional()
    .transform((v) => (v == null || v === '' ? def : Number(v)))
    .pipe(z.number().int().positive());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: int(8080),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: z.enum(['require', 'disable']).default('require'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be >= 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be >= 16 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  OTP_PEPPER: z.string().min(16, 'OTP_PEPPER must be >= 16 chars'),
  OTP_TTL_SECONDS: int(300),
  OTP_MAX_REQUESTS_PER_WINDOW: int(3),
  OTP_REQUEST_WINDOW_SECONDS: int(600),
  OTP_MAX_VERIFY_ATTEMPTS: int(5),
  OTP_MOCK: bool(false),

  MSG91_AUTH_KEY: z.string().optional().default(''),
  MSG91_SENDER_ID: z.string().optional().default(''),
  MSG91_TEMPLATE_ID: z.string().optional().default(''),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  PUBLIC_WEB_BASE_URL: z.string().url().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`\nInvalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const config = parsed.data;
export const isProd = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

// Hard safety rails for production (spec §8).
if (isProd) {
  const unsafe = [];
  if (/change-me/i.test(config.JWT_ACCESS_SECRET)) unsafe.push('JWT_ACCESS_SECRET');
  if (/change-me/i.test(config.JWT_REFRESH_SECRET)) unsafe.push('JWT_REFRESH_SECRET');
  if (/change-me/i.test(config.OTP_PEPPER)) unsafe.push('OTP_PEPPER');
  if (config.OTP_MOCK) unsafe.push('OTP_MOCK must be false in production');
  if (config.CORS_ORIGINS.includes('*')) unsafe.push('CORS_ORIGINS must not contain "*"');
  if (unsafe.length) {
    // eslint-disable-next-line no-console
    console.error(`\nRefusing to start in production with unsafe config:\n  ${unsafe.join('\n  ')}\n`);
    process.exit(1);
  }
}
