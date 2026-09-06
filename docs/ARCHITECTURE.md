# Architecture & deviations from the build spec

This file records decisions made while building, and every place the
implementation deviates from the pasted spec (with the reason). Keep it current.

## Confirmed decisions

| Topic | Decision | Note |
|---|---|---|
| Frontend framework | React + Vite + Tailwind (JavaScript, not TS) | Spec left it open. Component model fits the shopkeeper dashboard + voice UI state; clean Capacitor path. TS migration considered and declined mid-build to keep momentum. |
| Visual theme | **Blend**: violet primary actions (violet-600) on warm stone-neutral surfaces; pill buttons, 24px card radii, ≥48px targets kept | Reconciles primary spec §2 ("deliberate warm palette", elderly-friendly) with a later request for a premium violet SaaS look. Tokens in `frontend/src/index.css`. |
| Icons | lucide-react | Added for the shopkeeper dashboard; emoji still used for product icons. |
| CSV parsing | papaparse (frontend) | Client-side catalog import preview. Input is normalised (BOM strip, CRLF→LF) before parse. Server-side import (real DB) uses a different parser at step 9. |
| Dep pin | `overrides: { qs: ^6.16.0 }` in root package.json | express@4 transitively pins a `qs` with a moderate DoS/array-limit advisory; the override forces the patched line. Revisit when moving to express@5. |
| Demo state | React Context store (`frontend/src/store.jsx`) | Holds role + demo order queue + per-shop open/closed for VITE_DEMO mode. Component API meant to survive the swap to real API calls at build steps 3-6. |
| Price display | Per-shop `price_display_mode` = `exact` \| `range` \| `hidden`, shopkeeper's choice | NOT a cross-shop comparison surface, so it does not conflict with the permanent "no price comparison" rule (spec §1). `range` shows a rounded ±12% band; `hidden` omits price entirely from the public API. Migration `0003`. |
| DB access | Supabase Postgres for **every** environment, via Knex + SQL migrations | Deviates from spec §12's "SQLite for local dev". Chosen to eliminate SQLite↔Postgres dialect drift (row-level locking syntax, upserts, types) which the atomic stock-reservation logic (§3) is sensitive to. Local dev uses `supabase start` or a hosted free project. |
| Auth | Custom phone-OTP + signed JWTs (HS256), short-lived access + revocable refresh | Per spec §1 (common identity across roles) and §8. **Not** Supabase Auth. |
| Module system | ESM everywhere (`"type": "module"`) | Node 20+; modern deps. |

## Deviations / adaptations in the data model (spec §4)

Spec §4 says "adapt field types to chosen DB". Beyond types:

- **`users`** — no `role` column and no delivery-partner fields, per spec §1.
  Shopkeeper capability is implied by owning a row in `shops`, not a flag.
- **`shops.owner_user_id`** — added (FK → `users.id`). Needed for ownership
  checks (§8 "a user can only read/modify their own resources"). `owner_name`
  and `shops.phone_number` remain as the shop's public contact info, which may
  differ from the owner's login phone.
- **`otp_verifications.otp_hash`** — the spec lists `otp_code`. We store a
  keyed hash (HMAC-SHA-256 with a server pepper), never the plaintext code, in
  the spirit of §8 ("never log OTP codes ... in plaintext"). Hashing at rest is
  strictly safer and standard.
- **`refresh_tokens`** — new table, not in §4's list. Required by §8's
  "revocable refresh token": stores `token_hash`, `expires_at`, `revoked_at`,
  plus `user_agent` / `ip` for audit. Raw tokens are never stored.
- **`updated_at` triggers** — a `set_updated_at()` trigger is attached to every
  table with an `updated_at` column so it actually moves on UPDATE.
- All PKs are `uuid` with `gen_random_uuid()` default (non-enumerable, §8).

## Open items / waiting on the user

- **DB access** — no Docker / Supabase CLI / Postgres on this machine. Need
  either a hosted Supabase connection string in `backend/.env`, or Docker +
  `npm i -g supabase` then `supabase start`. Migrations & DB-backed tests
  cannot run until then.
- **MSG91 credentials + DLT/sender-ID registration** — needed before real OTP
  SMS. `OTP_MOCK=true` covers local dev.
