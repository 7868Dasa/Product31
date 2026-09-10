/**
 * Spending report — pure aggregation over a shopper's orders.
 *
 * Phase 1: the report AND its printable PDF are free. Product 31 takes no
 * online payment at all (Cash on Pickup only) — a paid in-app feature would
 * be "digital content" and drag the store binary into Apple IAP / Play
 * Billing. See docs/COMPLIANCE.md §6.
 */
const PAID = ['COLLECTED'];
const PENDING = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'READY_FOR_PICKUP'];

const monthKey = (iso) => String(iso).slice(0, 7); // YYYY-MM

export function buildSpendReport(allOrders) {
  const mine = (allOrders || []).filter((o) => o.mine);
  const paid = mine.filter((o) => PAID.includes(o.status));
  const pending = mine.filter((o) => PENDING.includes(o.status));

  const byShop = new Map();
  const byMonth = new Map();
  const byItem = new Map();

  for (const o of paid) {
    const shop = o.shop_name || o.shop_slug;
    const s = byShop.get(shop) || { shop, orders: 0, spent: 0 };
    s.orders += 1;
    s.spent += o.subtotal_amount || 0;
    byShop.set(shop, s);

    const mk = monthKey(o.created_at);
    byMonth.set(mk, (byMonth.get(mk) || 0) + (o.subtotal_amount || 0));

    for (const it of o.items || []) {
      const key = it.name;
      const e = byItem.get(key) || { name: key, name_ta: it.name_ta || null, times: 0, qty: 0, spent: 0 };
      e.times += 1;
      e.qty += it.quantity || 0;
      e.spent += (it.unit_price || 0) * (it.quantity || 0);
      byItem.set(key, e);
    }
  }

  const dates = paid.map((o) => o.created_at).sort();

  return {
    generated_at: new Date().toISOString(),
    paid_total: round(paid.reduce((s, o) => s + (o.subtotal_amount || 0), 0)),
    pending_total: round(pending.reduce((s, o) => s + (o.subtotal_amount || 0), 0)),
    order_count: paid.length,
    pending_count: pending.length,
    first_order_at: dates[0] || null,
    last_order_at: dates[dates.length - 1] || null,
    shops_used: byShop.size,
    by_shop: [...byShop.values()].map((s) => ({ ...s, spent: round(s.spent) })).sort((a, b) => b.spent - a.spent),
    by_month: [...byMonth.entries()].map(([month, spent]) => ({ month, spent: round(spent) })).sort((a, b) => a.month.localeCompare(b.month)),
    top_items: [...byItem.values()].map((e) => ({ ...e, spent: round(e.spent), qty: round(e.qty) })).sort((a, b) => b.spent - a.spent).slice(0, 10),
    orders: paid.map((o) => ({
      order_code: o.order_code,
      shop: o.shop_name || o.shop_slug,
      date: o.created_at,
      total: o.subtotal_amount || 0,
      items: (o.items || []).map((i) => ({
        name: i.name,
        qty: i.quantity,
        unit: i.unit || (i.pack_size ? '' : 'pack'),
        unit_price: i.unit_price,
      })),
    })),
  };
}

function round(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
