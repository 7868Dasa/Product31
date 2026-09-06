/**
 * Centralised demo store (React Context). Holds the cross-cutting UI state
 * that has no backend yet: the chosen role, the demo shopkeeper's order queue,
 * and per-shop open/closed. All of this moves to real API calls as build
 * steps 3-6 land; the component API here is meant to survive that swap.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { seedDemoOrders, seedMyDemoOrders } from './lib/demoOrders.js';
import { demoInventoryFull, demoShop } from './lib/mockData.js';
import { catalogKey } from './lib/csv.js';
import { buildSpendReport } from './lib/spend.js';

const seedAllOrders = () => [...seedMyDemoOrders(), ...seedDemoOrders()];

const StoreContext = createContext(null);

const ROLE_KEY = 'p31.role';
const ORDERS_KEY = 'p31.demo.orders';
const SHOPSTATE_KEY = 'p31.demo.shopstate';
const CATALOG_KEY = 'p31.demo.catalog';
const MYSHOP_KEY = 'p31.demo.myshop';
const CART_KEY = 'p31.demo.cart';
const REPORT_KEY = 'p31.demo.report_unlocked';

const ORDER_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const newOrderCode = () =>
  Array.from({ length: 4 }, () => ORDER_ALPHABET[Math.floor(Math.random() * ORDER_ALPHABET.length)]).join('');

/** The pre-baked demo shop (used by "skip onboarding"). */
export const DEMO_SHOP_SLUG = 'MRGNKLKI';

function demoShopFull() {
  return {
    ...demoShop(DEMO_SHOP_SLUG),
    phone_number: '+919000000001',
    opening_hours: 'Mon–Sat 7:00–21:00, Sun 8:00–13:00',
    qr_generated_at: new Date().toISOString(),
  };
}

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, v) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

const STAMP = {
  ACCEPTED: 'accepted_at',
  REJECTED: 'rejected_at',
  READY_FOR_PICKUP: 'ready_at',
  COLLECTED: 'collected_at',
};

export function StoreProvider({ children }) {
  const [role, setRole] = useState(() => load(ROLE_KEY, null));
  const [orders, setOrders] = useState(() => load(ORDERS_KEY, null) || seedAllOrders());
  const [shopOpen, setShopOpen] = useState(() => load(SHOPSTATE_KEY, { [DEMO_SHOP_SLUG]: true }));
  const [catalog, setCatalog] = useState(
    () => load(CATALOG_KEY, null) || { [DEMO_SHOP_SLUG]: demoInventoryFull(DEMO_SHOP_SLUG) },
  );
  const [myShop, setMyShop] = useState(() => load(MYSHOP_KEY, null));
  const [cart, setCart] = useState(() => load(CART_KEY, {}));
  const [reportUnlocked, setReportUnlocked] = useState(() => load(REPORT_KEY, false));

  useEffect(() => save(REPORT_KEY, reportUnlocked), [reportUnlocked]);
  useEffect(() => save(ROLE_KEY, role), [role]);
  useEffect(() => save(ORDERS_KEY, orders), [orders]);
  useEffect(() => save(SHOPSTATE_KEY, shopOpen), [shopOpen]);
  useEffect(() => save(CATALOG_KEY, catalog), [catalog]);
  useEffect(() => save(MYSHOP_KEY, myShop), [myShop]);
  useEffect(() => save(CART_KEY, cart), [cart]);

  /**
   * Persist a shop (from the onboarding API response, or the demo shop) as
   * the signed-in shopkeeper's shop, and seed its catalog / open-state.
   */
  const adoptShop = useCallback((shop, { seedCatalog = false } = {}) => {
    setMyShop(shop);
    setShopOpen((p) => ({ ...p, [shop.slug]: shop.is_open ?? false }));
    setCatalog((c) => ({
      ...c,
      [shop.slug]: c[shop.slug] || (seedCatalog ? demoInventoryFull(shop.slug) : []),
    }));
    return shop;
  }, []);

  /** Skip onboarding — use the fully-populated demo shop. */
  const useDemoShop = useCallback(
    () => adoptShop(demoShopFull(), { seedCatalog: true }),
    [adoptShop],
  );

  /** Upsert one row into a shop's catalog by (name, pack_size). */
  const upsertRows = useCallback((slug, rows) => {
    let added = 0;
    let updated = 0;
    setCatalog((c) => {
      const list = [...(c[slug] || [])];
      const indexOf = (r) =>
        list.findIndex((x) => catalogKey(x.name, x.pack_size) === catalogKey(r.name, r.pack_size));
      for (const r of rows) {
        const i = indexOf(r);
        if (i >= 0) {
          list[i] = { ...list[i], ...r, id: list[i].id };
          updated += 1;
        } else {
          list.push({ ...r, id: `${slug}-${catalogKey(r.name, r.pack_size)}-${Date.now()}-${added}` });
          added += 1;
        }
      }
      return { ...c, [slug]: list };
    });
    return { added, updated };
  }, []);

  const transition = useCallback((id, status, extra = {}) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, status, ...extra, [STAMP[status] || 'updated_at']: new Date().toISOString() }
          : o,
      ),
    );
  }, []);

  const value = {
    role,
    setRole,
    myShop,
    adoptShop,
    useDemoShop,
    clearMyShop: () => setMyShop(null),
    orders,
    ordersForShop: (slug) => orders.filter((o) => o.shop_slug === slug),
    /** Shopper's own orders across EVERY shop, newest first. */
    myOrders: () =>
      orders.filter((o) => o.mine).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    /** Free: the spending report data over the shopper's own orders. */
    spendReport: () => buildSpendReport(orders),
    reportUnlocked,
    /** Demo: simulate the one-time ₹29 unlock (no real charge). */
    unlockSpendReport: () => {
      setReportUnlocked(true);
      return { unlocked: true, amount: 29, currency: 'INR', demo: true, at: new Date().toISOString() };
    },
    /** Put a past order's lines back in that shop's cart. */
    buyAgain: (order) => {
      const lines = (order.items || []).map((it, i) => ({
        id: `${order.shop_slug}-again-${i}-${Date.now()}`,
        name: it.name,
        name_ta: it.name_ta || null,
        pack_size: it.pack_size || null,
        unit_price: it.unit_price || 0,
        qty: it.quantity,
        sell_by: it.sell_by || 'pack',
        unit: it.unit || 'pack',
      }));
      setCart((c) => ({ ...c, [order.shop_slug]: lines }));
      return order.shop_slug;
    },
    acceptOrder: (id) => transition(id, 'ACCEPTED'),
    rejectOrder: (id, reason) => transition(id, 'REJECTED', { rejection_reason: reason || 'Item not available' }),
    markReady: (id) => transition(id, 'READY_FOR_PICKUP'),
    markCollected: (id) => transition(id, 'COLLECTED'),
    isShopOpen: (slug) => shopOpen[slug] ?? true,
    toggleShopOpen: (slug) => setShopOpen((p) => ({ ...p, [slug]: !(p[slug] ?? true) })),
    resetDemoOrders: () => setOrders(seedAllOrders()),

    // ── catalog (shopkeeper's own view — exact prices) ──────────────────
    catalogForShop: (slug) => catalog[slug] || [],
    addCatalogItem: (slug, item) => upsertRows(slug, [item]),
    importCatalogRows: (slug, rows) => upsertRows(slug, rows),
    updateCatalogItem: (slug, id, patch) =>
      setCatalog((c) => ({
        ...c,
        [slug]: (c[slug] || []).map((it) => (it.id === id ? { ...it, ...patch } : it)),
      })),
    removeCatalogItem: (slug, id) =>
      setCatalog((c) => ({ ...c, [slug]: (c[slug] || []).filter((it) => it.id !== id) })),
    resetDemoCatalog: (slug) =>
      setCatalog((c) => ({ ...c, [slug]: demoInventoryFull(slug) })),

    // ── cart (single shop only, spec motto) + place order ───────────────
    // A line carries how it's sold so the pickup slip is unambiguous:
    //   { id, name, name_ta, pack_size, unit_price, qty,
    //     sell_by, unit, price_basis, base_unit, min_qty, max_qty, step_qty }
    // qty is a count for pack/piece, a numeric amount (in base_unit) for weight.
    cartForShop: (slug) => cart[slug] || [],
    addToCart: (slug, item) =>
      setCart((c) => {
        const list = [...(c[slug] || [])];
        const add = Number(item.qty || (item.sell_by === 'weight' ? item.step_qty || 0.25 : 1));
        const i = list.findIndex((l) => l.id === item.id);
        if (i >= 0) {
          const next = Math.round((list[i].qty + add) * 1000) / 1000;
          list[i] = { ...list[i], qty: Math.min(next, list[i].max_qty || Infinity) };
        } else {
          list.push({ ...item, qty: add });
        }
        return { ...c, [slug]: list };
      }),
    setCartQty: (slug, id, qty) =>
      setCart((c) => ({
        ...c,
        [slug]: (c[slug] || [])
          .map((l) => (l.id === id ? { ...l, qty: Math.round(qty * 1000) / 1000 } : l))
          .filter((l) => l.qty > 0),
      })),
    clearCart: (slug) => setCart((c) => ({ ...c, [slug]: [] })),
    /** Demo checkout: push a PENDING order the shopkeeper dashboard will see. */
    placeOrder: (slug, { customerName = 'Demo shopper', customerPhone = '+9198••••0000', pickup = 'ASAP' } = {}) => {
      const lines = cart[slug] || [];
      if (!lines.length) return null;
      const order = {
        id: `o${Date.now()}`,
        order_code: newOrderCode(),
        shop_slug: slug,
        shop_name: (demoShop(slug) || myShop || {}).shop_name || slug,
        status: 'PENDING_ACCEPTANCE',
        created_at: new Date().toISOString(),
        pending_acceptance_at: new Date().toISOString(),
        mine: true,
        customer_name: customerName,
        customer_phone: customerPhone,
        pickup_slot_label: pickup,
        items: lines.map((l) => ({
          name: l.name,
          name_ta: l.name_ta || null,
          pack_size: l.pack_size || null,
          quantity: l.qty,
          unit_price: l.unit_price || 0,
          sell_by: l.sell_by || 'pack',
          unit: l.unit || (l.sell_by === 'weight' ? l.base_unit || 'kg' : l.sell_by === 'piece' ? 'pcs' : 'pack'),
          price_basis: l.price_basis || 'per_pack',
          line_total: Math.round((l.unit_price || 0) * l.qty * 100) / 100,
        })),
        subtotal_amount: Math.round(lines.reduce((s, l) => s + (l.unit_price || 0) * l.qty, 0) * 100) / 100,
      };
      setOrders((prev) => [order, ...prev]);
      setCart((c) => ({ ...c, [slug]: [] }));
      return order;
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
