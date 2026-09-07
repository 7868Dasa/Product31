/**
 * Best-effort parse of a shop's freeform `opening_hours` string into a single
 * daily open window. Tier-3 kiranas almost always run one continuous window
 * ("Mon-Sat 7:00-21:00, Sun 8:00-13:00" -> we take 7:00-21:00). If the string
 * can't be parsed we fail OPEN — the manual is_open toggle is the real gate;
 * this is just so a shopper doesn't order at 2 AM by accident.
 *
 * Pure, no deps — safe to port to the backend later if server-side hours
 * enforcement is wanted (would need the structured-hours schema first).
 */

const AMPM = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?/i;
const H24 = /(\d{1,2}):(\d{2})/;

function toMinutes(token) {
  const t = token.trim();
  let m = AMPM.exec(t);
  if (m) {
    let h = Number(m[1]) % 12;
    if (/p/i.test(m[3])) h += 12;
    return h * 60 + Number(m[2] || 0);
  }
  m = H24.exec(t);
  if (m) {
    const h = Number(m[1]);
    if (h > 23) return null;
    return h * 60 + Number(m[2]);
  }
  m = /^(\d{1,2})$/.exec(t); // bare hour
  if (m) {
    const h = Number(m[1]);
    return h <= 23 ? h * 60 : null;
  }
  return null;
}

/** @returns {{open:number, close:number}|null} minutes-from-midnight, or null */
export function parseDailyWindow(str) {
  if (!str || typeof str !== 'string') return null;
  // first "A - B" range anywhere in the string (en dash, em dash, hyphen, "to")
  const m = /(\d[\d:]*\s*[ap]?\.?m?\.?)\s*(?:[–—-]|to)\s*(\d[\d:]*\s*[ap]?\.?m?\.?)/i.exec(str);
  if (!m) return null;
  const open = toMinutes(m[1]);
  const close = toMinutes(m[2]);
  if (open == null || close == null || close <= open) return null;
  return { open, close };
}

/** Is `now` inside the shop's parsed window? True if unparseable (fail open). */
export function isWithinHours(str, now = new Date()) {
  const w = parseDailyWindow(str);
  if (!w) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= w.open && mins < w.close;
}

function fmt(mins, lang) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(lang === 'ta' ? 'ta-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** "opens 7:00 AM" style label, or '' if hours are unknown. */
export function opensAtLabel(str, lang = 'en', now = new Date()) {
  const w = parseDailyWindow(str);
  if (!w) return '';
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins < w.open ? fmt(w.open, lang) : fmt(w.open, lang); // next opening is today's open time
}
