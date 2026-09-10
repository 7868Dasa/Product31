# Product 31 — compliance checklist

**Not legal advice.** This tracks what needs doing and who owns it. A qualified
Indian lawyer (data protection + consumer + IT Act) and a CA (entity + GST)
must sign off before public launch.

Owner key: **DEV** = code in this repo · **LEGAL** = lawyer · **CA** = accountant
· **YOU** = founder action (registration/portal) · **OPS** = ongoing process

Status: ☐ not started · ◐ in progress · ☑ done (code) · ⚖ awaiting legal sign-off

---

## 1. Data protection — DPDP Act 2023

| Item | Owner | Status |
|---|---|---|
| Privacy notice, plain language, English + Tamil | LEGAL / DEV | ◐ draft page shipped (`/legal/privacy`, marked DRAFT) |
| Explicit, granular, withdrawable consent at signup | DEV | ☑ consent screen + `user_consents` audit table |
| Consent record (who, what, when, version, source, IP) | DEV | ☑ `user_consents` append-only |
| Purpose limitation / data minimisation | DEV | ☑ no `role` column, no PII in URLs, slugs random |
| Right to access / data export (machine-readable) | DEV | ☑ `GET /users/me/export` |
| Right to correction | DEV | ☑ `PATCH /users/me` |
| Right to erasure | DEV | ☑ `DELETE /users/me` — scrubs PII, retains anonymised txn record |
| Retention policy + automated purge | DEV / OPS | ◐ `lib/retention.js` (OTPs 24h, security events >400d); wire to cron at build step 4 |
| Grievance / DPO contact published | YOU / LEGAL | ☐ put a real email + name in the policy pages |
| Personal data breach notification process | OPS / LEGAL | ☐ runbook + Data Protection Board reporting path |
| Children's data — no under-18 without parental consent | LEGAL / DEV | ◐ age-confirmation checkbox on consent screen; ToS clause |
| Cross-border transfer disclosure (Supabase US, Groq US, etc.) | LEGAL | ☐ list processors + regions in the privacy policy |
| Data Processing Agreements with processors | LEGAL | ☐ Supabase, MSG91, Resend, FCM, (Groq/Sarvam if used) |
| Voice ordering: OS speech recognizer is a 3rd-party processor (Google/Apple); no audio stored, transcript only | DEV / LEGAL | ◐ disclosed in `/legal/privacy` + in-app note; add Google & Apple to processor list + DPAs. See `docs/mobile/CAPACITOR_VOICE.md` |

## 2. IT Act 2000 §79 + Intermediary Rules 2021 (safe harbour)

| Item | Owner | Status |
|---|---|---|
| Terms of Service published | LEGAL / DEV | ◐ draft page shipped |
| Privacy policy published | LEGAL / DEV | ◐ draft page shipped |
| Grievance Officer appointed + named in-app | YOU / LEGAL | ☐ |
| Grievance mechanism (form + acknowledgement) | DEV | ☐ next slice |
| Takedown / unlawful-content process | OPS / LEGAL | ☐ |
| Merchant (shopkeeper) agreement | LEGAL | ☐ |

## 3. CERT-In 2022 directions (cyber)

| Item | Owner | Status |
|---|---|---|
| Security/audit event log | DEV | ☑ `security_events` table + `lib/audit.js` wired into all auth flows |
| Log retention ≥ 180 days, stored in India | OPS / DEV | ◐ retention sweep keeps ≥ 400d; host DB in an India region |
| Incident reporting within 6 hours | OPS | ☐ runbook + CERT-In contact |
| NTP sync to NPL / NIC | OPS | ☐ server config (`server 14.139.60.103`, `time.nplindia.org`) |
| Vulnerability disclosure policy | DEV | ☑ `/.well-known/security.txt` + `/legal/security` |
| Dependency audit in CI | DEV / OPS | ◐ `npm audit` 0 today; add Dependabot + CI gate |

## 4. Consumer Protection (E-Commerce) Rules 2020

| Item | Owner | Status |
|---|---|---|
| Seller (shop) identity shown: name, address, contact | DEV | ☑ shop detail + onboarding |
| Clear total price, no hidden charges | DEV | ☑ per-item price / range / at-counter; COD only |
| Cancellation outcomes defined (REJECTED / EXPIRED / NO_SHOW) | DEV / LEGAL | ◐ state machine built (`lib/orderState.js` + `modules/orders`, forward-only, guarded); consumer-facing policy text pending |
| Grievance officer + SLA (48h ack / 1 month resolve) | YOU / DEV | ☐ |
| No unfair trade practice / no fake reviews | DEV | ☑ no reviews feature exists |

## 5. Telecom — TRAI DLT (for SMS OTP)

| Item | Owner | Status |
|---|---|---|
| Register Principal Entity on a DLT portal | YOU | ☐ **start now — longest lead time** |
| Register Header (sender ID) | YOU | ☐ |
| Register OTP content template (transactional) | YOU | ☐ |
| Register "order rejected" content template (transactional) | YOU | ☐ `MSG91_REJECT_TEMPLATE_ID` — the only order-status SMS |
| MSG91 linked to the registered entity | YOU | ☐ |
| Dev uses `OTP_MOCK=true` until the above clears | DEV | ☑ |

## 6. Payments

**Phase 1 takes no money through the app — at all.** Cash on Pickup only; the
spending report and its printable PDF are free. This keeps the store binary
100% physical-commerce, which is explicitly exempt from Apple IAP and Google
Play Billing. A paid in-app digital feature (e.g. a report unlock) would be
"digital content" and force IAP/Play Billing (15–30% cut, StoreKit/Billing
integration, digital-goods refund policy) — deferred out of Phase 1.

| Item | Owner | Status |
|---|---|---|
| **Cash-on-pickup ordering: no online payment** → no RBI PA licence, no PCI-DSS, no escrow | DECISION | ☑ hold this line |
| **Spending-report PDF is free** (no in-app purchase anywhere in the app) | DECISION | ☑ built free; `report_purchases` schema removed |
| No IAP / Play Billing surface → avoids the store digital-goods commission + review friction | DECISION | ☑ |
| One-time / recurring payment frameworks (RBI e-mandate, pre-debit notice, AFA) | — | ☑ N/A — no payments |
| **Future phase**, if a paid digital feature is added: gateway (Razorpay/Cashfree/PhonePe), GST-compliant invoice (digital service = 18%), digital-goods refund policy in Terms, **and** Apple IAP / Play Billing (mandatory for in-app digital goods) | LEGAL / DEV / YOU | ☐ deferred |

## 7. Business & tax

| Item | Owner | Status |
|---|---|---|
| Entity registration (Pvt Ltd / LLP) | YOU / CA | ☐ |
| GST registration (if commission via app / threshold) | CA | ☐ |
| Shops & Establishments Act (office) | YOU | ☐ |
| Professional tax | CA | ☐ |
| Marketplace facilitator / TCS analysis | CA / LEGAL | ☐ |

## 8. IP & licensing

| Item | Owner | Status |
|---|---|---|
| Third-party OSS notices (all MIT/Apache/BSD — commercial OK) | DEV | ☐ `NOTICE` file — next slice |
| Open Food Facts attribution (images CC-BY-SA, data ODbL) | DEV | ☐ attribution UI + `NOTICE` — next slice |
| Brand names (Aachi/Aavin/Tata) — nominative use, no implied endorsement | LEGAL | ☐ confirm |
| "Product 31" trademark search + filing | LEGAL | ☐ |

## 9. App store (when native app exists)

| Item | Owner | Status |
|---|---|---|
| Play Data Safety form | YOU | ☐ — voice: audio accessed, not stored/shared; see `docs/mobile/CAPACITOR_VOICE.md` §5 |
| Apple Privacy Nutrition Labels | YOU | ☐ — Audio Data: not collected (transcript only) |
| Mic + speech permission rationale (point-of-use; audio → OS recognizer Google/Apple; transcript only) | DEV / LEGAL | ☑ strings in `docs/mobile/CAPACITOR_VOICE.md` §2–3; in-app note `voice.privacyNote`; denied-state handled |
| iOS `NSMicrophoneUsageDescription` + `NSSpeechRecognitionUsageDescription` (EN + TA) | DEV | ☐ add to `Info.plist` on `cap add ios` |
| Android `RECORD_AUDIO` + `<queries>` RecognitionService | DEV | ☐ verify on `cap add android` |
| Reviewer notes cover voice (mic only while listening; EN + TA sample phrase) | YOU | ☐ |
| Location permission rationale | DEV | ☐ |
| Android App Links / iOS Universal Links `.well-known` files | DEV | ☐ build step 14 |

## 10. Security engineering (OWASP ASVS / Top 10)

| Item | Status |
|---|---|
| Parameterised queries everywhere (Knex) | ☑ |
| Explicit input validation (zod) at every boundary | ☑ |
| Signed JWT: short access + revocable refresh (hashed at rest) | ☑ |
| OTP hashed at rest (HMAC-SHA-256 + pepper), never logged plaintext | ☑ |
| Rate limits: per-phone OTP + per-IP API | ☑ |
| `helmet` security headers, CORS allow-list, body size limit | ☑ |
| Secrets not in git; least-privilege DB user | ☑ / OPS |
| HTTPS enforced in production | OPS |
| Global JSON error handler, no stack traces to clients | ☑ |
| Auth + security event audit log | ☑ (this slice) |
| Pen test before launch | ☐ OPS |
| Encryption at rest (Supabase-managed) + in transit (TLS) | ☑ / OPS |

---

## This slice delivered (2026-09-01)

1. `docs/COMPLIANCE.md` — this file
2. Consent screen at signup + `user_consents` audit + `/auth/me` reports consent state
3. `DELETE /users/me` (PII scrub, txn record retained), `GET /users/me/export`
4. `security_events` table + `lib/audit.js` wired into every auth flow;
   `lib/retention.js` purge functions
5. Draft `/legal/privacy`, `/legal/terms`, `/legal/security` pages (marked DRAFT)
