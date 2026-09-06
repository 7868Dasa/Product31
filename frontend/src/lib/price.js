/**
 * Price display helpers. Mirrors backend priceBand so demo mode matches the
 * real API. A shop's `price_mode` is set by the shopkeeper: 'exact' | 'range'
 * | 'hidden'.
 */
export function priceBand(price) {
  const step = 5;
  const lo = Math.max(step, Math.round((price * 0.88) / step) * step);
  const hi = Math.round((price * 1.12) / step) * step;
  return { price_min: lo, price_max: Math.max(hi, lo + step) };
}

/** " /kg", " /l", " each" — the unit a weight/piece price is quoted in. */
export function priceBasisSuffix(item) {
  if (item.price_basis === 'per_kg') return '/kg';
  if (item.price_basis === 'per_l') return '/l';
  if (item.price_basis === 'per_piece') return ' each';
  return '';
}

/**
 * Given an inventory item (already shaped for its shop's mode) return a
 * display string, or null when the shop hides prices.
 * `t` is the i18n translate fn.
 */
export function formatItemPrice(item, t) {
  const suffix = priceBasisSuffix(item);
  if (item.price != null) return t('price.rupee', { amount: item.price }) + suffix;
  if (item.price_min != null) {
    return (
      `${t('price.rupee', { amount: item.price_min })}–${t('price.rupee', { amount: item.price_max })}` +
      suffix
    );
  }
  return null; // hidden
}
