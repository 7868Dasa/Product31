import { defineConfig } from 'vitest/config';

// Safe, fake values so config.js validation passes in CI without a real .env.
// Integration tests that actually touch Postgres read DATABASE_URL from the
// real environment (export it, or run `node --env-file=.env`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://user:pass@localhost:5432/product31_test',
      DATABASE_SSL: process.env.DATABASE_SSL ?? 'disable',
      JWT_ACCESS_SECRET: 'test-access-secret-000000000000',
      JWT_REFRESH_SECRET: 'test-refresh-secret-00000000000',
      OTP_PEPPER: 'test-otp-pepper-0000000000000000',
      OTP_MOCK: 'true',
      CORS_ORIGINS: 'http://localhost:5173',
    },
  },
});
