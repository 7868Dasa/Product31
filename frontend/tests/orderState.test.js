import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  STATUS,
  TERMINAL,
  TRANSITIONS,
  nextStatus,
  isExpired,
  computeTotals,
} from '../src/lib/orderState.js';

const here = fileURLToPath(new URL('.', import.meta.url));

describe('orderState parity with the backend', () => {
  it('frontend/src/lib/orderState.js is byte-identical to backend/src/lib/orderState.js', () => {
    const fe = readFileSync(`${here}../src/lib/orderState.js`, 'utf8');
    const be = readFileSync(`${here}../../backend/src/lib/orderState.js`, 'utf8');
    expect(fe).toBe(be);
  });
});

describe('orderState behaviour (frontend copy)', () => {
  it('walks the happy path', () => {
    expect(nextStatus(STATUS.PENDING_ACCEPTANCE, 'accept')).toBe(STATUS.ACCEPTED);
    expect(nextStatus(STATUS.ACCEPTED, 'ready')).toBe(STATUS.READY_FOR_PICKUP);
    expect(nextStatus(STATUS.READY_FOR_PICKUP, 'collect')).toBe(STATUS.COLLECTED);
  });

  it('blocks illegal and terminal transitions', () => {
    expect(nextStatus(STATUS.PENDING_ACCEPTANCE, 'collect')).toBeNull();
    for (const term of TERMINAL) {
      for (const action of Object.keys(TRANSITIONS)) {
        expect(nextStatus(term, action)).toBeNull();
      }
    }
  });

  it('expires only PENDING past the SLA', () => {
    const now = 1_700_000_000_000;
    expect(isExpired(STATUS.PENDING_ACCEPTANCE, now - 6 * 60_000, 5, now)).toBe(true);
    expect(isExpired(STATUS.PENDING_ACCEPTANCE, now - 3 * 60_000, 5, now)).toBe(false);
    expect(isExpired(STATUS.ACCEPTED, now - 60 * 60_000, 5, now)).toBe(false);
  });

  it('recomputes totals from trusted prices', () => {
    const { subtotal } = computeTotals(
      [
        { product_id: 'a', quantity: 2 },
        { product_id: 'b', quantity: 0.25 },
      ],
      (id) => ({ a: 60, b: 145 }[id]),
    );
    expect(subtotal).toBe(156.25);
  });
});
