import { describe, it, expect } from 'vitest';
import {
  STATUS,
  ACTIVE,
  TERMINAL,
  TRANSITIONS,
  nextStatus,
  actorFor,
  stampFor,
  needsReason,
  isExpired,
  computeTotals,
  planPartialFulfilment,
} from '../src/lib/orderState.js';

describe('nextStatus — legal transitions', () => {
  it('walks the happy path place -> accept -> ready -> collect', () => {
    expect(nextStatus(STATUS.PENDING_ACCEPTANCE, 'accept')).toBe(STATUS.ACCEPTED);
    expect(nextStatus(STATUS.ACCEPTED, 'ready')).toBe(STATUS.READY_FOR_PICKUP);
    expect(nextStatus(STATUS.READY_FOR_PICKUP, 'collect')).toBe(STATUS.COLLECTED);
  });

  it('allows collect straight from ACCEPTED (shopper grabbed it fast)', () => {
    expect(nextStatus(STATUS.ACCEPTED, 'collect')).toBe(STATUS.COLLECTED);
  });

  it('allows reject and expire only from PENDING_ACCEPTANCE', () => {
    expect(nextStatus(STATUS.PENDING_ACCEPTANCE, 'reject')).toBe(STATUS.REJECTED);
    expect(nextStatus(STATUS.PENDING_ACCEPTANCE, 'expire')).toBe(STATUS.EXPIRED);
    expect(nextStatus(STATUS.ACCEPTED, 'reject')).toBeNull();
    expect(nextStatus(STATUS.ACCEPTED, 'expire')).toBeNull();
  });

  it('allows no_show only after acceptance', () => {
    expect(nextStatus(STATUS.ACCEPTED, 'no_show')).toBe(STATUS.NO_SHOW);
    expect(nextStatus(STATUS.READY_FOR_PICKUP, 'no_show')).toBe(STATUS.NO_SHOW);
    expect(nextStatus(STATUS.PENDING_ACCEPTANCE, 'no_show')).toBeNull();
  });

  it('walks the partial-fulfilment branch: flag -> confirm back to ACCEPTED', () => {
    expect(nextStatus(STATUS.ACCEPTED, 'flag_unavailable')).toBe(STATUS.PENDING_CONFIRMATION);
    expect(nextStatus(STATUS.PENDING_CONFIRMATION, 'confirm_reduced')).toBe(STATUS.ACCEPTED);
  });

  it('walks the partial-fulfilment branch: flag -> cancel', () => {
    expect(nextStatus(STATUS.ACCEPTED, 'flag_unavailable')).toBe(STATUS.PENDING_CONFIRMATION);
    expect(nextStatus(STATUS.PENDING_CONFIRMATION, 'cancel_order')).toBe(STATUS.CANCELLED);
  });

  it('only allows flag_unavailable from ACCEPTED (not before or after packing starts)', () => {
    expect(nextStatus(STATUS.PENDING_ACCEPTANCE, 'flag_unavailable')).toBeNull();
    expect(nextStatus(STATUS.READY_FOR_PICKUP, 'flag_unavailable')).toBeNull();
  });

  it('only allows confirm_reduced/cancel_order from PENDING_CONFIRMATION', () => {
    expect(nextStatus(STATUS.ACCEPTED, 'confirm_reduced')).toBeNull();
    expect(nextStatus(STATUS.ACCEPTED, 'cancel_order')).toBeNull();
  });
});

describe('nextStatus — illegal transitions return null', () => {
  it('rejects the PENDING -> COLLECTED skip', () => {
    expect(nextStatus(STATUS.PENDING_ACCEPTANCE, 'collect')).toBeNull();
    expect(nextStatus(STATUS.PENDING_ACCEPTANCE, 'ready')).toBeNull();
  });

  it('rejects any transition out of a terminal status', () => {
    for (const term of TERMINAL) {
      for (const action of Object.keys(TRANSITIONS)) {
        expect(nextStatus(term, action)).toBeNull();
      }
    }
  });

  it('rejects re-accepting a rejected order', () => {
    expect(nextStatus(STATUS.REJECTED, 'accept')).toBeNull();
  });

  it('rejects an unknown action', () => {
    expect(nextStatus(STATUS.PENDING_ACCEPTANCE, 'teleport')).toBeNull();
    expect(actorFor('teleport')).toBeNull();
    expect(stampFor('teleport')).toBeNull();
  });
});

describe('transition metadata', () => {
  it('only owner, shopper, or system actors exist', () => {
    for (const t of Object.values(TRANSITIONS)) {
      expect(['owner', 'shopper', 'system']).toContain(t.actor);
    }
  });

  it('expire is the only system action', () => {
    const system = Object.entries(TRANSITIONS).filter(([, t]) => t.actor === 'system');
    expect(system.map(([k]) => k)).toEqual(['expire']);
  });

  it('confirm_reduced and cancel_order are the only shopper actions', () => {
    const shopper = Object.entries(TRANSITIONS).filter(([, t]) => t.actor === 'shopper');
    expect(shopper.map(([k]) => k).sort()).toEqual(['cancel_order', 'confirm_reduced']);
  });

  it('reject is the only action needing a reason', () => {
    expect(needsReason('reject')).toBe(true);
    expect(needsReason('accept')).toBe(false);
    expect(needsReason('collect')).toBe(false);
  });

  it('every action stamps a distinct *_at column', () => {
    const stamps = Object.values(TRANSITIONS).map((t) => t.stamp);
    expect(new Set(stamps).size).toBe(stamps.length);
    for (const s of stamps) expect(s).toMatch(/_at$/);
  });

  it('ACTIVE and TERMINAL together cover every status exactly once', () => {
    const all = [...ACTIVE, ...TERMINAL].sort();
    expect(all).toEqual(Object.values(STATUS).sort());
  });
});

describe('isExpired', () => {
  const NOW = 1_700_000_000_000;

  it('expires a PENDING order past the SLA', () => {
    const placed = NOW - 6 * 60_000; // 6 min ago
    expect(isExpired(STATUS.PENDING_ACCEPTANCE, placed, 5, NOW)).toBe(true);
  });

  it('does not expire within the SLA', () => {
    const placed = NOW - 3 * 60_000;
    expect(isExpired(STATUS.PENDING_ACCEPTANCE, placed, 5, NOW)).toBe(false);
  });

  it('never expires a non-PENDING order', () => {
    const placed = NOW - 999 * 60_000;
    expect(isExpired(STATUS.ACCEPTED, placed, 5, NOW)).toBe(false);
    expect(isExpired(STATUS.READY_FOR_PICKUP, placed, 5, NOW)).toBe(false);
    expect(isExpired(STATUS.COLLECTED, placed, 5, NOW)).toBe(false);
  });

  it('is safe with missing inputs', () => {
    expect(isExpired(STATUS.PENDING_ACCEPTANCE, null, 5, NOW)).toBe(false);
    expect(isExpired(STATUS.PENDING_ACCEPTANCE, NOW, 0, NOW)).toBe(false);
    expect(isExpired(STATUS.PENDING_ACCEPTANCE, NOW, -1, NOW)).toBe(false);
  });

  it('is exclusive at exactly the SLA boundary', () => {
    const placed = NOW - 5 * 60_000; // exactly 5 min
    expect(isExpired(STATUS.PENDING_ACCEPTANCE, placed, 5, NOW)).toBe(false);
  });
});

describe('computeTotals', () => {
  const prices = { rice: 62, dal: 145, oil: 155 };
  const priceOf = (id) => prices[id];

  it('recomputes line totals and subtotal from server prices, ignoring the client', () => {
    const { lines, subtotal } = computeTotals(
      [
        { product_id: 'rice', quantity: 2, unit_price: 1 }, // client lied
        { product_id: 'dal', quantity: 1 },
      ],
      priceOf,
    );
    expect(lines[0]).toMatchObject({ unit_price: 62, quantity: 2, line_total: 124 });
    expect(lines[1]).toMatchObject({ unit_price: 145, quantity: 1, line_total: 145 });
    expect(subtotal).toBe(269);
  });

  it('handles fractional weight quantities (0.25 kg)', () => {
    const { lines, subtotal } = computeTotals([{ product_id: 'dal', quantity: 0.25 }], priceOf);
    expect(lines[0].line_total).toBe(36.25);
    expect(subtotal).toBe(36.25);
  });

  it('rounds to paise, not fractions of a paisa', () => {
    const { subtotal } = computeTotals([{ product_id: 'oil', quantity: 0.333 }], (id) => ({ oil: 155 }[id]));
    expect(subtotal).toBe(51.62);
  });

  it('throws ITEM_NOT_SOLD_HERE when the shop has no price for a product', () => {
    expect(() => computeTotals([{ product_id: 'ghee', quantity: 1 }], priceOf)).toThrow('ITEM_NOT_SOLD_HERE');
    try {
      computeTotals([{ product_id: 'ghee', quantity: 1 }], priceOf);
    } catch (e) {
      expect(e.code).toBe('ITEM_NOT_SOLD_HERE');
      expect(e.product_id).toBe('ghee');
    }
  });

  it('throws BAD_QUANTITY for zero, negative, or non-numeric quantity', () => {
    for (const q of [0, -1, 'x', NaN]) {
      expect(() => computeTotals([{ product_id: 'rice', quantity: q }], priceOf)).toThrow('BAD_QUANTITY');
    }
  });

  it('throws EMPTY_ORDER for an empty or non-array item list', () => {
    expect(() => computeTotals([], priceOf)).toThrow('EMPTY_ORDER');
    expect(() => computeTotals(null, priceOf)).toThrow('EMPTY_ORDER');
  });
});

describe('planPartialFulfilment', () => {
  const items = [
    { id: 'i1', line_total: 100 },
    { id: 'i2', line_total: 50 },
    { id: 'i3', line_total: 25 },
  ];

  it('sums only the lines not flagged unavailable', () => {
    expect(planPartialFulfilment(items, ['i2'])).toEqual({ allUnavailable: false, subtotal: 125 });
  });

  it('flags allUnavailable when every remaining line is flagged', () => {
    expect(planPartialFulfilment(items, ['i1', 'i2', 'i3'])).toEqual({ allUnavailable: true, subtotal: 0 });
  });

  it('treats items already marked unavailable as already excluded', () => {
    const withPreflagged = [...items.slice(0, 2), { id: 'i3', line_total: 25, unavailable: true }];
    expect(planPartialFulfilment(withPreflagged, ['i2'])).toEqual({ allUnavailable: false, subtotal: 100 });
  });

  it('flagging nothing leaves the full subtotal untouched', () => {
    expect(planPartialFulfilment(items, [])).toEqual({ allUnavailable: false, subtotal: 175 });
  });
});
