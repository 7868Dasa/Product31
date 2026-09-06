/**
 * End-to-end auth flow against a real Postgres. Skipped automatically when no
 * database is reachable (so `npm test` stays green before DB setup). To run it:
 *
 *   cd backend && node --env-file=.env node_modules/knex/bin/cli.js migrate:latest
 *   DATABASE_URL=... npm test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, pingDb, closeDb } from '../src/db.js';

const dbUp = await pingDb().then(() => true).catch(() => false);
const app = createApp();
const phone = `+9198${String(Date.now()).slice(-8)}`;

describe.skipIf(!dbUp)('auth flow (needs Postgres)', () => {
  beforeAll(async () => {
    await db('refresh_tokens').whereRaw('true').del().catch(() => {});
    await db('otp_verifications').where({ phone_number: phone }).del().catch(() => {});
    await db('users').where({ phone_number: phone }).del().catch(() => {});
  });

  afterAll(async () => {
    await db('users').where({ phone_number: phone }).del().catch(() => {});
    await closeDb();
  });

  let refreshToken;
  let accessToken;

  it('issues an OTP and returns dev_otp in mock mode', async () => {
    const res = await request(app).post('/api/v1/auth/otp/request').send({ phone_number: phone });
    expect(res.status).toBe(201);
    expect(res.body.dev_otp).toMatch(/^\d{6}$/);
    app.locals._devOtp = res.body.dev_otp;
  });

  it('rejects a wrong OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone_number: phone, otp_code: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OTP_INVALID');
  });

  it('verifies the correct OTP, creates the user, returns tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phone_number: phone, otp_code: app.locals._devOtp });
    expect(res.status).toBe(200);
    expect(res.body.is_new_user).toBe(true);
    expect(res.body.user.phone_number).toBe(phone);
    expect(res.body.user.is_phone_verified).toBe(true);
    expect(res.body.access_token).toBeTruthy();
    accessToken = res.body.access_token;
    refreshToken = res.body.refresh_token;
  });

  it('GET /auth/me works with the access token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.phone_number).toBe(phone);
  });

  it('PATCH /users/me updates allowed fields only', async () => {
    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ full_name: 'Test Shopper', preferred_language: 'ta' });
    expect(res.status).toBe(200);
    expect(res.body.user.full_name).toBe('Test Shopper');
    expect(res.body.user.preferred_language).toBe('ta');
  });

  it('refresh rotates the token (old one stops working)', async () => {
    const first = await request(app).post('/api/v1/auth/refresh').send({ refresh_token: refreshToken });
    expect(first.status).toBe(200);
    const newRefresh = first.body.refresh_token;
    expect(newRefresh).not.toBe(refreshToken);

    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refresh_token: refreshToken });
    expect(reuse.status).toBe(401);

    refreshToken = newRefresh;
  });

  it('logout revokes the refresh token', async () => {
    const out = await request(app).post('/api/v1/auth/logout').send({ refresh_token: refreshToken });
    expect(out.status).toBe(204);

    const after = await request(app).post('/api/v1/auth/refresh').send({ refresh_token: refreshToken });
    expect(after.status).toBe(401);
  });
});
