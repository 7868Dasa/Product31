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
 *        │ ACCEPTED │                                             │
 *        └──────────┘                                             │
 *             │ ready (owner)          collect (owner) ─► COLLECTED
 *             ▼                              ▲
 *    ┌──────────────────┐  collect (owner) ──┘
 *    │ READY_FOR_PICKUP │  no_show (owner) ──► NO_SHOW
 *    └──────────────────┘
 */

export const STATUS = {
  PENDING_ACCEPTANCE: 'PENDING_ACCEPTANCE',
  ACCEPTED: 'ACCEPTED',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  COLLECTED: 'COLLECTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  NO_SHOW: 'NO_SHOW',
};

/** Orders a shopkeeper still has to act on / a shopper is still waiting on. */
export const ACTIVE = [STATUS.PENDING_ACCEPTANCE, STATUS.ACCEPTED, STATUS.READY_FOR_PICKUP];

/** No transition leaves these. */
export const TERMINAL = [STATUS.COLLECTED, STATUS.REJECTED, STATUS.EXPIRED, STATUS.NO_SHOW];

/**
 * Every legal transition: which statuses it may start from, where it lands,
 * who is allowed to trigger it, and which timestamp column it stamps.
 *   actor 'owner'  — the shop's owner_user_id
 *   actor 'system' — lazy expiry, no human
 */
export const TRANSITIONS = {
  accept: { from: [STATUS.PENDING_ACCEPTANCE], to: STATUS.ACCEPTED, actor: 'owner', stamp: 'accepted_at' },
  reject: { from: [STATUS.PENDING_ACCEPTANCE], to: STATUS.REJECTED, actor: 'owner', stamp: 'rejected_at', reason: true },
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

/** Which actor is allowed to trigger `action` ('owner' | 'system'), or null. */
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
