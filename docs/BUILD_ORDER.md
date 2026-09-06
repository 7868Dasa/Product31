# Build order (from spec §13)

Legend: `[x]` done · `[~]` in progress · `[ ]` not started

- [~] **1. Data model + auth** — phone/email registration, OTP verification
      (mock OTP acceptable for initial local dev)
- [~] **2. Shop discovery + single-shop product browsing** — nearby shops by
      GPS radius (open/closed, distance, open-first sort), single-shop live
      inventory grouped by category with exact prices + stock state. Verified
      in demo mode; DB-backed verification pending Postgres.
- [~] 3. Cart + order placement — **demo-level done** (pulled forward for voice):
      single-shop cart, numeric quantities (`0.75 kg` is real), manual "＋ Add"
      + voice both feed it, cart drawer with mode-aware steppers (count vs
      250 g step), order snapshot carries `sell_by`/`unit`/`price_basis`/
      `line_total`, "Place order — Cash on pickup" pushes a PENDING order the
      shopkeeper dashboard shows. Remaining: real backend endpoint, idempotency
      key, atomic row-level stock locking (§3).

- [x] **Variable net weight** (plan-eng-review scope C) — migration `0005`:
      `master_products.default_sell_by`/`net_weight_value`/`net_weight_unit`/
      `base_unit`; `shop_inventory` `stock_qty`→`stock_amount` (numeric) +
      `sell_by`/`price_basis`/`min`/`max`/`step_qty`/`est_unit_weight_g`;
      `order_items.quantity`→numeric + `sell_by`/`unit`/`price_basis`. Seeds
      updated (rice/dal/sugar per kg, oil per l, coconut per piece). Backend
      `publicInventoryItem` emits the fields. Frontend + voice consume them.
      Deferred: shopkeeper weight-stepper UI (with build step 6).
- [~] 4. Order state machine (Direction B — scoped down, see plan-eng-review).
      **Done:** pure forward-only state machine in `lib/orderState.js` (shared
      byte-identical with the frontend, parity-tested); backend `orders` module
      (`POST /shops/:slug/orders` with idempotency key + server-side price
      recompute, `GET /shops/:slug/orders` owner-only queue, `GET /orders/mine`,
      `GET /orders/:id`, `POST /orders/:id/transitions` with actor + legal-
      transition guards + `order_status_history`); **lazy expiry** (a stale
      PENDING order flips to EXPIRED on the next read — no worker); reject → one
      best-effort SMS via MSG91 (`MSG91_REJECT_TEMPLATE_ID`); migration `0008`
      scopes `order_code` unique per (shop, day). Frontend `store.jsx` order
      methods now call the API; `mockApi.js` serves them in demo mode; Orders
      page polls while an order is active + refetches on focus; shopkeeper
      dashboard polls the queue. **Deferred:** background SLA/no-show worker
      (lazy expiry covers the pilot), FCM push (poll + reject-SMS instead),
      atomic stock decrement (reject-with-reason is the safety net).
- [~] 5. Shopkeeper self-service onboarding (§5). Backend: `POST /shops`
      (authed, mints non-guessable slug, `qr_generated_at`), `GET /shops/mine`,
      migration `0004` (opening_hours). Frontend demo: phone-OTP → shop-details
      form (name/category/owner/phone/address/hours, GPS-assisted location with
      manual override, per-shop price-display mode) → success screen with QR +
      share URL. "Skip → demo shop" shortcut. Remaining: real auth wiring, edit
      later.
- [~] 6. Shopkeeper dashboard — **pulled forward** (product is shopkeeper-first
      SaaS). Done in demo: landing role toggle, Open/Closed toggle, live order
      queue (New / Preparing / Today) with accept→ready→collected + SLA
      countdown, today's cash summary. Remaining: QR tab, full sidebar layout
      >820px, real API wiring.
- [~] 9. Bulk CSV upload — **pulled forward** into the Stock tab. Done in demo:
      catalog list with inline price edit + qty steppers + Selling/Hidden
      toggle + delete; manual Add-item modal with variant-group hint; CSV
      import with sample-template download, client-side parse (papaparse,
      BOM/CRLF/quoted-comma safe), preview modal (new/update/skipped counts,
      per-row tags, skipped rows with line numbers + reasons), upsert by
      (name, pack_size). Remaining: server-side import endpoint (needs
      shopkeeper auth from step 5), optional photo upload (step 10), barcode
      auto-fill (step 13).
- [~] 7. QR + poster + `/s/:slug` deep link (§11.1–11.2). `/s/:slug` web
      fallback done since step 2 and verified for onboarded shops (scan → shop
      screen, even brand-new/empty). Backend: `qrcode` PNG endpoint + `pdfkit`
      A4 poster endpoint (`GET /shops/:slug/qr.png`, `/poster.pdf`), tested.
      Frontend: client-side QR (`qrcode`), printable poster page at `/p/:slug`
      (window.print → Save as PDF), re-downloadable from the dashboard QR tab
      (§5). Remaining: Android App Links / iOS Universal Links (step 14),
      non-blocking app-install banner (§11.3).
- [ ] 8. Wishlist + order history + "Buy Again"
- [ ] 9. Bulk Excel/CSV upload
- [ ] 10. Product image upload/compression pipeline (§7)
- [ ] 11. Security hardening pass (§8) — before real users; confirm shop slugs
      are non-guessable
- [~] 12. Voice ordering (§9) — **rule-based layer built & tested** (51 tests).
      `lib/voice/`: normalize (Tamil+English fillers, number-words, fractions
      "half"/"arai"/"முக்கால்"/"onnarai", weight parse "750 gram"/"2.5 kg"),
      segment (multi-item split on commas / "and" / "um" / "appuram"), match
      (fuzzy + variant disambiguation + generic-token guard + **sell_by
      branch**: weight→amount, piece→count, pack→size), session (queued
      multi-turn clarifications, "how much?" for weight), asr (Web Speech API),
      **tts (spoken replies, Tamil only if a ta voice exists)**. `VoiceOrder`
      panel: mic + text fallback, conversation, **mute toggle**, size/quantity
      chips, **compact order table** (bilingual headers), feeds the cart.
      Replies + TTS follow the app language. **Free — no API key, no model
      download.** Remaining: Vosk offline fallback, optional Sarvam/Groq LLM
      layer (§9.4.2), real-device Tamil ASR + TTS testing (§9.6).
- [ ] 13. Optional: barcode auto-fill (§10)
- [ ] 14. Optional: Capacitor packaging + App Links/Universal Links (§11.2) +
      optional non-blocking app-install banner (§11.3)

## Step 1 — detail

Backend
- [x] Monorepo scaffold, env template, gitignore
- [x] Express app: helmet, CORS allowlist, body size limits, pino logging,
      global JSON error handler
- [x] Knex config (Postgres, env-driven)
- [x] Migration `0001_init` — all core tables (§4) + `refresh_tokens` +
      `updated_at` triggers
- [x] Seed `0001_master_products` — small starter catalog incl. a 3-pack-size
      variant group for the §9 voice test
- [x] OTP: keyed-hash at rest, TTL, request + verify rate limits (DB-backed)
- [x] JWT: short access + revocable refresh (hashed in `refresh_tokens`)
- [x] Routes: `POST /auth/otp/request`, `POST /auth/otp/verify`,
      `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`,
      `PATCH /users/me`
- [x] Unit tests: OTP hash/generate, JWT sign/verify, zod schemas
- [ ] Integration test: full OTP → tokens → /me → refresh → logout  *(needs DB)*

Frontend
- [x] Vite + React + Tailwind scaffold, warm palette, i18n (en/ta)
- [x] Login screen: phone → OTP → logged in  (big targets, icon+text)
- [x] VITE_DEMO mode: frontend fakes all API calls (no backend/DB needed)
- [ ] Verified end-to-end against a running DB  *(needs DB)*

## Step 2 — detail

Backend
- [x] `GET /shops?lat&lng&radius_km` — haversine distance in SQL, radius
      filter (max 25 km), open-shops-first + nearest sort
- [x] `GET /shops/:slug` — single shop (slug validated, no path tricks)
- [x] `GET /shops/:slug/inventory` — join master_products, grouped-ready,
      `in_stock` computed; browsing is public (no auth)
- [x] Seed `0002_demo_shops` — 6 shops around Kallakurichi + inventory
      (incl. an out-of-stock row and low-stock rows)
- [x] Tests: haversine (known distances, symmetry), query/slug schemas
- [ ] DB-backed verification of the 3 endpoints  *(needs DB)*

Frontend
- [x] react-router-dom v7; routes `/shops`, `/s/:slug` (deep-link ready for
      step 7), `/login`, `/account`
- [x] Shop list: location (geolocation opt-in + saved + default), radius
      chips, open/closed badges, distance, loading/empty/error states
- [x] Shop detail: header, closed banner, inventory grouped by category,
      ₹ prices, out-of-stock / low-stock, Tamil-primary names when lang=ta
- [x] "Look around first" — browse without signing in (spec §11)
- [x] Verified in demo mode (EN + TA), no console errors, build clean
