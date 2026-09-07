/**
 * The canonical shop-type list, in display order. One shared source so the
 * shopkeeper onboarding picker, shop-edit, and the discovery filter all agree
 * and show the same order. Keep it short — a Tier-3 town has a handful of
 * retail types, not fifty.
 */
export const SHOP_CATEGORIES = [
  'Grocery',
  'Bakery',
  'Supermarket',
  'Retail',
  'Tea Shop',
  'Pharmacy',
  'Stationery',
];

/** Sort a set of category strings into SHOP_CATEGORIES order (unknowns last). */
export function orderCategories(cats) {
  const rank = (c) => {
    const i = SHOP_CATEGORIES.indexOf(c);
    return i === -1 ? SHOP_CATEGORIES.length : i;
  };
  return [...cats].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
