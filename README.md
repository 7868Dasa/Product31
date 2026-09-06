# Product 31

Hyperlocal **order-ahead & walk-in-collect** app for Tier 3 Tamil Nadu towns.

> **Motto: time saved, not queue joined.** This app exists to remove one pain —
> standing in line at a shop. A shopper browses **one shop's** live inventory,
> orders ahead (tap, voice in Tamil/English, or QR scan), walks in, collects,
> and pays **cash**. It is not a marketplace and never compares shops.

## Phase 1 scope (what this repo builds)

Retail shops only. Two roles: **shopper** and **shopkeeper** (both full, incl.
shopkeeper self-service onboarding + QR/PDF). Cash on Pickup only. Strict
forward-only order state machine with SLA auto-expiry and no-show detection.

**Not in Phase 1** (stop and flag if a request drifts here): delivery of any
kind and the delivery-partner role, online payment, non-retail categories,
cross-shop comparison (permanent), mandatory product photos (permanent),
hard blocking app-store redirects, voice languages beyond Tamil/English.

## Stack

| Layer | Choice |
|---|---|
| Backend | Node.js + Express (ESM), Knex migrations |
| Database | Supabase Postgres — same engine every environment |
| Auth | Custom phone-number OTP + signed JWTs (**not** Supabase Auth) |
| Frontend | React + Vite + Tailwind |
| SMS OTP | MSG91 (mock in local dev) |
| Push / email | FCM / Resend (later build steps) |

## Layout

```
backend/    Express API, migrations, seeds, background jobs
frontend/   React + Vite web app (later wrapped with Capacitor)
docs/       Architecture notes & deviations from the spec
```

## Getting started

```bash
npm install
cp .env.example backend/.env      # fill in DATABASE_URL + secrets
cp .env.example frontend/.env     # VITE_API_BASE_URL is enough
npm run migrate
npm run seed
npm run dev
```

You need a Postgres database. Either create a free Supabase project and paste
its connection string into `backend/.env`, or run `supabase start` locally
(requires Docker) and use the local connection string.

## Build order

Tracked in [docs/BUILD_ORDER.md](docs/BUILD_ORDER.md). Current: **step 1 —
data model + phone/OTP auth**.
