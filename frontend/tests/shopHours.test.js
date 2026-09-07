import { describe, it, expect } from 'vitest';
import { parseDailyWindow, isWithinHours, opensAtLabel } from '../src/lib/shopHours.js';

const at = (h, m = 0) => {
  const d = new Date(2026, 0, 5, h, m, 0); // a Monday
  return d;
};

describe('parseDailyWindow', () => {
  it('parses a 24h range', () => {
    expect(parseDailyWindow('Mon-Sat 7:00-21:00, Sun 8:00-13:00')).toEqual({ open: 420, close: 1260 });
  });

  it('parses an en-dash range', () => {
    expect(parseDailyWindow('Daily 6:30–22:00')).toEqual({ open: 390, close: 1320 });
  });

  it('parses am/pm', () => {
    expect(parseDailyWindow('9am to 9pm')).toEqual({ open: 540, close: 1260 });
    expect(parseDailyWindow('7:30 AM - 10:00 PM')).toEqual({ open: 450, close: 1320 });
  });

  it('parses bare hours', () => {
    expect(parseDailyWindow('open 7 - 21')).toEqual({ open: 420, close: 1260 });
  });

  it('returns null when it cannot parse (fail open)', () => {
    expect(parseDailyWindow('call to check')).toBeNull();
    expect(parseDailyWindow('')).toBeNull();
    expect(parseDailyWindow(null)).toBeNull();
  });

  it('rejects a backwards or zero-length range', () => {
    expect(parseDailyWindow('21:00 - 7:00')).toBeNull();
    expect(parseDailyWindow('8:00 - 8:00')).toBeNull();
  });
});

describe('isWithinHours', () => {
  const hours = 'Mon-Sat 7:00-21:00';

  it('is inside the window', () => {
    expect(isWithinHours(hours, at(12))).toBe(true);
    expect(isWithinHours(hours, at(7, 0))).toBe(true);
  });

  it('is outside the window', () => {
    expect(isWithinHours(hours, at(6, 59))).toBe(false);
    expect(isWithinHours(hours, at(21, 0))).toBe(false);
    expect(isWithinHours(hours, at(2))).toBe(false);
  });

  it('fails open when hours are unknown', () => {
    expect(isWithinHours('ring the bell', at(3))).toBe(true);
    expect(isWithinHours(undefined, at(3))).toBe(true);
  });
});

describe('opensAtLabel', () => {
  it('formats the opening time', () => {
    const label = opensAtLabel('Mon-Sat 7:00-21:00', 'en', at(3));
    expect(label).toMatch(/7[:.]00/);
  });

  it('is empty when hours are unknown', () => {
    expect(opensAtLabel('whenever', 'en')).toBe('');
  });
});
