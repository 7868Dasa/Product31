/**
 * Pure order state-machine logic. NO database, NO Express, NO imports.
 *
 * A BYTE-IDENTICAL copy of this file lives at frontend/src/lib/orderState.js
 * so demo mode (mockApi) and the real backend never diverge. A parity test in
 * each package asserts the two files match exactly — if you edit one, copy it
 * to the other verbatim.
 *
 *        place (shopper)
 *             │
 *             ▼
 *   ┌───────────────────┐  reject (owner,+reason) ─► REJECTED   ─┐
 *   │ PENDING_ACCEPTANCE │                                        │ terminal
 *   └───────────────────┘  now-placed > sla ─────► EXPIRED  ─────┤ (system, lazy)
 *             │ accept (owner)                                    │
 *             ▼                                                   │
 *        ┌──────────┐  no_show (owner) ─────────► NO_SHOW  ───────┤
 *        │ ACCEPTED │◄────────────────────┐                       │
 *        └──────────┘                     │ confirm_reduced       │
 *          │      │ flag_unavailable      │ (shopper)             │
 *          │      ▼ (owner, some lines    │                       │
 *          │  ┌──────────────────────┐    │                       │
 *          │  │ PENDING_CONFIRMATION │────┘                       │
 *          │  └──────────────────────┘                            │
 *          │      │ cancel_order (shopper) ──► CANCELLED ─────────┤
 *          │ ready (owner)          collect (owner) ─► COLLECTED
 *          ▼                              ▲
 *    ┌──────────────────┐  collect (owner) ──┘
 *    │ READY_FOR_PICKUP │  no_show (owner) ──► NO_SHOW
 *    └──────────────────┘
 *
 * Partial fulfilment (spec follow-up #5, Option A): the shop can only flag
 * items unavailable while packing (ACCEPTED, before READY_FOR_PICKUP) — the
 * shopper must explicitly confirm the reduced order or cancel; the shop can
 * never silently substitute or reduce what was agreed. If every line would
 * be unavailable, the shop uses `reject` instead — there's nothing to
 * confirm a reduction to.
 */

export const STATUS = {
  PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
  ACCEPTED: 'ACCEPTED',
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  COLLECTED: 'COLLECTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
};

/** Orders a shopkeeper still has to act on / a shopper is still waiting on. */
export const ACTIVE = [
  STATUS.PENDING_ACCEPTANCE,
  STATUS.ACCEPTED,
  STATUS.PENDING_CONFIRMATION,
  STATUS.READY_FOR_PICKUP,
];

/** No transition leaves these. */
export const TERMINAL = [
  STATUS.COLLECTED,
  STATUS.REJECTED,
  STATUS.EXPIRED,
  STATUS.NO_SHOW,
  STATUS.CANCELLED,
];

/**
 * Every legal transition: which statuses it may start from, where it lands,
 * who is allowed to trigger it, and which timestamp column it stamps.
 *   actor 'owner'   — the shop's owner_user_id
 *   actor 'shopper' — the order's user_id
 *   actor 'system'  — lazy expiry, no human
 */
export const TRANSITIONS = {
  accept: { from: [STATUS.PENDING_ACCEPTANCE], to: STATUS.ACCEPTED, actor: 'owner', stamp: 'accepted_at' },
  reject: { from: [STATUS.PENDING_ACCEPTANCE], to: STATUS.REJECTED, actor: 'owner', stamp: 'rejected_at', reason: true },
  flag_unavailable: { from: [STATUS.ACCEPTED], to: STATUS.PENDING_CONFIRMATION, actor: 'owner', stamp: 'flagged_at' },
  confirm_reduced: { from: [STATUS.PENDING_CONFIRMATION], to: STATUS.ACCEPTED, actor: 'shopper', stamp: 'confirmed_at' },
  cancel_order: { from: [STATUS.PENDING_CONFIRMATION], to: STATUS.CANCELLED, actor: 'shopper', stamp: 'cancelled_at' },
  ready: { from: [STATUS.ACCEPTED], to: STATUS.READY_FOR_PICKUP, actor: 'owner', stamp: 'ready_at' },
  collect: { from: [STATUS.ACCEPTED, STATUS.READY_FOR_PICKUP], to: STATUS.COLLECTED, actor: 'owner', stamp: 'collected_at' },
  no_show: { from: [STATUS.ACCEPTED, STATUS.READY_FOR_PICKUP], to: STATUS.NO_SHOW, actor: 'owner', stamp: 'no_show_at' },
  expire: { from: [STATUS.PENDING_ACCEPTANCE], to: STATUS.EXPIRED, actor: 'system', stamp: 'expired_at' },
};

/** Resolve an action against the current status. null = illegal from here. */
export function nextStatus(current, action) {
  const t = TRANSITIONS[action];
  if (!t || !t.from.includes(current)) return null;
  return t.to;
}

/** Which actor is allowed to trigger `action` ('owner' | 'shopper' | 'system'), or null. */
export function actorFor(action) {
  return TRANSITIONS[action] ? TRANSITIONS[action].actor : null;
}

/** The timestamp column `action` writes, or null. */
export function stampFor(action) {
  return TRANSITIONS[action] ? TRANSITIONS[action].stamp : null;
}

/** Does `action` require a rejection reason? */
export function needsReason(action) {
  return Boolean(TRANSITIONS[action] && TRANSITIONS[action].reason);
}

/**
 * Is a PENDING_ACCEPTANCE order past its acceptance SLA?
 * @param {string} status       current order status
 * @param {number} placedAtMs   ms-epoch of pending_acceptance_at (or created_at)
 * @param {number} slaMinutes   shop.acceptance_sla_minutes
 * @param {number} [nowMs]      injected for tests
 */
export function isExpired(status, placedAtMs, slaMinutes, nowMs = Date.now()) {
  if (status !== STATUS.PENDING_ACCEPTANCE) return false;
  if (!placedAtMs || !slaMinutes || slaMinutes <= 0) return false;
  return nowMs - placedAtMs > slaMinutes * 60_000;
}

/**
 * Recompute line totals and the subtotal from TRUSTED prices. The client's
 * prices are never used — this is what stops a tampered cart from misleading
 * the shopkeeper at the counter.
 *
 * @param {{product_id: string, quantity: number|string}[]} items
 * @param {(productId: string) => (number|undefined)} priceOf  server price per unit
 * @returns {{ lines: {product_id, quantity, unit_price, line_total}[], subtotal: number }}
 * @throws {Error & {code:'ITEM_NOT_SOLD_HERE', product_id:string}} if a price is missing
 * @throws {Error & {code:'BAD_QUANTITY', product_id:string}} if quantity <= 0 or NaN
 */
export function computeTotals(items, priceOf) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('EMPTY_ORDER');
    err.code = 'EMPTY_ORDER';
    throw err;
  }
  const lines = items.map((it) => {
    const unit = priceOf(it.product_id);
    if (unit == null || Number.isNaN(Number(unit))) {
      const err = new Error('ITEM_NOT_SOLD_HERE');
      err.code = 'ITEM_NOT_SOLD_HERE';
      err.product_id = it.product_id;
      throw err;
    }
    const qty = Number(it.quantity);
    if (!(qty > 0)) {
      const err = new Error('BAD_QUANTITY');
      err.code = 'BAD_QUANTITY';
      err.product_id = it.product_id;
      throw err;
    }
    const unitPrice = Math.round(Number(unit) * 100) / 100;
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;
    return { product_id: it.product_id, quantity: qty, unit_price: unitPrice, line_total: lineTotal };
  });
  const subtotal = Math.round(lines.reduce((s, l) => s + l.line_total, 0) * 100) / 100;
  return { lines, subtotal };
}

/**
 * Partial fulfilment (#5, Option A). Given the order's items (each with a
 * `line_total` and an `unavailable` flag) and the set of item ids the shop
 * just flagged, decide what happens next:
 *   - flagging every remaining line -> not a reduction, the caller should
 *     use `reject` instead (nothing left to confirm down to).
 *   - otherwise -> the new subtotal counting only the still-available lines,
 *     for the shopper's "confirm ₹X or cancel" prompt.
 *
 * @param {{id:string, line_total:number, unavailable?:boolean}[]} items
 * @param {string[]} unavailableIds  order_item ids the shop is flagging now
 * @returns {{ allUnavailable: boolean, subtotal: number }}
 */
export function planPartialFulfilment(items, unavailableIds) {
  const flagged = new Set(unavailableIds);
  const stillAvailable = items.filter((it) => !it.unavailable && !flagged.has(it.id));
  const subtotal =
    Math.round(stillAvailable.reduce((s, it) => s + Number(it.line_total || 0), 0) * 100) / 100;
  return { allUnavailable: stillAvailable.length === 0, subtotal };
}
