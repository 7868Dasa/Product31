/**
 * Centralised UI store (React Context).
 *
 * Orders now live in the backend (build step 4). This store keeps a fetched
 * cache of the shopper's own orders and each shop's queue, plus the bits that
 * still have no backend: chosen role, the demo shopkeeper's shop, per-shop
 * open/closed, the local cart, and the ₹29 report-unlock flag. In VITE_DEMO
 * the api() calls are served by lib/mockApi.js off localStorage.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from './lib/api.js';
import { demoInventoryFull, demoShop } from './lib/mockData.js';
import { catalogKey } from './lib/csv.js';
import { buildSpendReport } from './lib/spend.js';
import { ACTIVE } from './lib/orderState.js';

const StoreContext = createContext(null);

const ROLE_KEY = 'p31.role';
const SHOPSTATE_KEY = 'p31.demo.shopstate';
const CATALOG_KEY = 'p31.demo.catalog';
const MYSHOP_KEY = 'p31.demo.myshop';
const CART_KEY = 'p31.demo.cart';
const REPORT_KEY = 'p31.demo.report_unlocked';
const ORDERS_KEY = 'p31.demo.orders'; // owned by mockApi; cleared by resetDemoOrders

/** The pre-baked demo shop (used by "skip onboarding"). */
export const DEMO_SHOP_SLUG = 'MRGNKLKI';

const newIdemKey = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

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

export function StoreProvider({ children }) {
  const [role, setRole] = useState(() => load(ROLE_KEY, null));
  const [shopOpen, setShopOpen] = useState(() => load(SHOPSTATE_KEY, { [DEMO_SHOP_SLUG]: true }));
  const [catalog, setCatalog] = useState(
    () => load(CATALOG_KEY, null) || { [DEMO_SHOP_SLUG]: demoInventoryFull(DEMO_SHOP_SLUG) },
  );
  const [myShop, setMyShop] = useState(() => load(MYSHOP_KEY, null));
  const [cart, setCart] = useState(() => load(CART_KEY, {}));
  const [reportUnlocked, setReportUnlocked] = useState(() => load(REPORT_KEY, false));

  // Backend-backed caches.
  const [myOrdersList, setMyOrdersList] = useState([]);
  const [queues, setQueues] = useState({}); // slug -> orders[]

  useEffect(() => save(REPORT_KEY, reportUnlocked), [reportUnlocked]);
  useEffect(() => save(ROLE_KEY, role), [role]);
  useEffect(() => save(SHOPSTATE_KEY, shopOpen), [shopOpen]);
  useEffect(() => save(CATALOG_KEY, catalog), [catalog]);
  useEffect(() => save(MYSHOP_KEY, myShop), [myShop]);
  useEffect(() => save(CART_KEY, cart), [cart]);

  // ── shop adoption (demo shopkeeper) ────────────────────────────────────
  const adoptShop = useCallback((shop, { seedCatalog = false } = {}) => {
    setMyShop(shop);
    setShopOpen((p) => ({ ...p, [shop.slug]: shop.is_open ?? false }));
    setCatalog((c) => ({
      ...c,
      [shop.slug]: c[shop.slug] || (seedCatalog ? demoInventoryFull(shop.slug) : []),
    }));
    return shop;
  }, []);

  const useDemoShop = useCallback(
    () => adoptShop(demoShopFull(), { seedCatalog: true }),
    [adoptShop],
  );

  /** Pull the signed-in owner's shop fresh from the backend. */
  const refreshMyShop = useCallback(async () => {
    try {
      const { shops } = await api('/shops/mine', { authed: true });
      const shop = shops && shops[0];
      if (shop) {
        setMyShop((prev) => ({ ...prev, ...shop }));
        setShopOpen((p) => ({ ...p, [shop.slug]: shop.is_open }));
      }
      return shop || null;
    } catch {
      return null;
    }
  }, []);

  /** Owner edits their shop (name, hours, price mode, is_open, …). */
  const updateMyShop = useCallback(
    async (patch) => {
      if (!myShop) return null;
      const { shop } = await api(`/shops/${myShop.slug}`, {
        method: 'PATCH',
        authed: true,
        body: patch,
      });
      setMyShop((prev) => ({ ...prev, ...shop }));
      if ('is_open' in patch) setShopOpen((p) => ({ ...p, [myShop.slug]: shop.is_open }));
      return shop;
    },
    [myShop],
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

  // ── orders: fetch + mutate via the API ────────────────────────────────
  const refreshMyOrders = useCallback(async () => {
    try {
      const { orders } = await api('/orders/mine', { authed: true });
      setMyOrdersList(orders);
      return orders;
    } catch {
      return [];
    }
  }, []);

  const refreshQueue = useCallback(async (slug, status) => {
    if (!slug) return [];
    try {
      const qs = status ? `?status=${status}` : '';
      const { orders } = await api(`/shops/${slug}/orders${qs}`, { authed: true });
      setQueues((q) => ({ ...q, [slug]: orders }));
      return orders;
    } catch {
      return [];
    }
  }, []);

  /** Patch one order everywhere it's cached after a transition. */
  const applyOrderUpdate = useCallback((order) => {
    setQueues((q) => {
      const next = {};
      for (const [slug, list] of Object.entries(q)) {
        next[slug] = list.map((o) => (o.id === order.id ? { ...o, ...order } : o));
      }
      return next;
    });
    setMyOrdersList((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...order } : o)));
  }, []);

  const placeOrder = useCallback(
    async (slug, { pickup = 'ASAP' } = {}) => {
      const lines = cart[slug] || [];
      if (!lines.length) return null;
      const { order } = await api(`/shops/${slug}/orders`, {
        method: 'POST',
        authed: true,
        body: {
          items: lines.map((l) => ({ item_id: l.id, quantity: l.qty })),
          idempotency_key: newIdemKey(),
          pickup_slot_label: pickup,
        },
      });
      setCart((c) => ({ ...c, [slug]: [] }));
      setMyOrdersList((prev) => [order, ...prev.filter((o) => o.id !== order.id)]);
      return order;
    },
    [cart],
  );

  const transition = useCallback(
    async (id, action, reason) => {
      const { order } = await api(`/orders/${id}/transitions`, {
        method: 'POST',
        authed: true,
        body: { action, ...(reason ? { reason } : {}) },
      });
      applyOrderUpdate(order);
      return order;
    },
    [applyOrderUpdate],
  );

  const acceptOrder = useCallback((id) => transition(id, 'accept'), [transition]);
  const rejectOrder = useCallback(
    (id, reason) => transition(id, 'reject', reason || 'Item not available'),
    [transition],
  );
  const markReady = useCallback((id) => transition(id, 'ready'), [transition]);
  const markCollected = useCallback((id) => transition(id, 'collect'), [transition]);

  const resetDemoOrders = useCallback(() => {
    try {
      localStorage.removeItem(ORDERS_KEY);
    } catch {
      /* ignore */
    }
    setQueues({});
    return refreshMyOrders();
  }, [refreshMyOrders]);

  const value = {
    role,
    setRole,
    myShop,
    adoptShop,
    useDemoShop,
    refreshMyShop,
    updateMyShop,
    clearMyShop: () => setMyShop(null),

    // ── orders (backend-backed) ────────────────────────────────────────
    myOrders: () => myOrdersList,
    ordersForShop: (slug) => queues[slug] || [],
    refreshMyOrders,
    refreshQueue,
    placeOrder,
    acceptOrder,
    rejectOrder,
    markReady,
    markCollected,
    resetDemoOrders,
    hasActiveOrder: () => myOrdersList.some((o) => ACTIVE.includes(o.status)),

    /** Free: the spending report over the shopper's own orders. */
    spendReport: () => buildSpendReport(myOrdersList),
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

    isShopOpen: (slug) =>
      myShop && myShop.slug === slug && typeof myShop.is_open === 'boolean'
        ? myShop.is_open
        : shopOpen[slug] ?? true,
    toggleShopOpen: (slug) => {
      // The owner's own shop is server-backed; demo shops stay local.
      if (myShop && myShop.slug === slug) {
        const next = !(typeof myShop.is_open === 'boolean' ? myShop.is_open : shopOpen[slug] ?? true);
        return updateMyShop({ is_open: next }).catch(() => {});
      }
      setShopOpen((p) => ({ ...p, [slug]: !(p[slug] ?? true) }));
      return Promise.resolve();
    },

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
    resetDemoCatalog: (slug) => setCatalog((c) => ({ ...c, [slug]: demoInventoryFull(slug) })),

    // ── cart (single shop only, spec motto) ────────────────────────────
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
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
