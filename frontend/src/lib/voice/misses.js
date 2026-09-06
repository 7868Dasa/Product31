/**
 * Layer 2 support — log every "not found" voice query. This log IS the list of
 * synonyms to add next. Free: localStorage now; a `POST /voice/misses`
 * endpoint later writes to the DB you already have.
 */
const KEY = 'p31.voice.misses';
const MAX = 200;

export function logVoiceMiss(query, shopSlug, lang) {
  const q = String(query || '').trim();
  if (!q) return;
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    list.push({ q, shop: shopSlug || null, lang: lang || null, at: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    /* ignore */
  }
  // Future: fire-and-forget POST /api/v1/voice/misses { q, shop, lang }
}

export function getVoiceMisses() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

/** Frequency-ranked misses — what to turn into synonyms first. */
export function topVoiceMisses(n = 20) {
  const counts = new Map();
  for (const m of getVoiceMisses()) counts.set(m.q, (counts.get(m.q) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([q, count]) => ({ q, count }));
}
