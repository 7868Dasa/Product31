/**
 * Frontend-only demo shim. When VITE_DEMO=true, api() routes here instead of
 * hitting the backend, so the UI is fully clickable with NO server and NO
 * database. This is throwaway scaffolding for previewing screens — it is not
 * the real auth flow and never ships to production.
 *
 * Dummy credentials: any 10-digit number, OTP code is always 123456.
 */
import { haversineKm } from './geo.js';
import { DEMO_SHOPS, demoShop, demoInventory, demoInventoryFull } from './mockData.js';
import { newShopSlug } from './slug.js';
import { shopShareUrl } from './qr.js';
import { priceBand } from './price.js';
import { seedDemoOrders, seedMyDemoOrders } from './demoOrders.js';
import { STATUS, ACTIVE, TRANSITIONS, nextStatus, isExpired } from './orderState.js';

const DEMO_OTP = '123456';
const USER_KEY = 'p31.demo.user';
const MYSHOP_KEY = 'p31.demo.myshop';
const CATALOG_KEY = 'p31.demo.catalog';
const ORDERS_KEY = 'p31.demo.orders';
const FAV_KEY = 'p31.favshops';
const DEMO_SLA_MIN = 5; // matches every demo shop's acceptance_sla_minutes

function loadFavs() {
  const v = readJson(FAV_KEY);
  return Array.isArray(v) ? v : [];
}
function saveFavs(list) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

const ORDER_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const demoOrderCode = () =>
  Array.from({ length: 4 }, () => ORDER_ALPHABET[Math.floor(Math.random() * ORDER_ALPHABET.length)]).join('');

// ── demo order store (localStorage; the mockApi owns it after the swap) ──────

function loadOrders() {
  const stored = readJson(ORDERS_KEY);
  if (Array.isArray(stored)) return stored;
  const seed = [...seedMyDemoOrders(), ...seedDemoOrders()];
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(seed));
  } catch {
    /* ignore */
  }
  return seed;
}
function saveOrders(list) {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function shopFor(slug) {
  return demoShop(slug) || myShopBySlug(slug) || { shop_name: slug, price_display_mode: 'exact' };
}

/** Light phone mask for the shopkeeper view (real backend uses lib/logger maskPhone). */
function maskDemoPhone(phone) {
  if (!phone) return null;
  if (phone.includes('•') || phone.includes('*')) return phone;
  const d = String(phone).replace(/\D/g, '');
  if (d.length < 4) return '••••';
  return `+91${d.slice(-10, -6).replace(/./g, '•')}••••${d.slice(-4)}`;
}
function priceModeOf(shop, order) {
  return (shop && (shop.price_display_mode || shop.price_mode)) || (order && order.price_mode) || 'exact';
}

/** id -> inventory/catalog row, the trusted price source in demo mode. */
function demoShopPrices(slug) {
  const rows = demoShop(slug)
    ? demoInventoryFull(slug)
    : (readJson(CATALOG_KEY) || {})[slug] || [];
  return new Map(rows.map((r) => [r.id, r]));
}

/** Flip any PENDING order past the SLA to EXPIRED (lazy, on read). */
function settleExpiry(list) {
  let changed = false;
  const out = list.map((o) => {
    const placed = Date.parse(o.pending_acceptance_at || o.created_at);
    if (isExpired(o.status, placed, DEMO_SLA_MIN)) {
      changed = true;
      return { ...o, status: STATUS.EXPIRED, expired_at: new Date().toISOString() };
    }
    return o;
  });
  return { list: out, changed };
}

/** Shape an order for the client, honouring hidden-price rules (plan-eng-review Q5). */
function serializeOrder(o, viewer, shop) {
  const mode = priceModeOf(shop, o);
  const hide = viewer === 'shopper' && mode === 'hidden' && o.status === STATUS.PENDING_ACCEPTANCE;
  const items = (o.items || []).map((it) => {
    const unitPrice = Number(it.unit_price || 0);
    const lineTotal =
      it.line_total != null
        ? Number(it.line_total)
        : Math.round(unitPrice * Number(it.quantity) * 100) / 100;
    return {
      name: it.name,
      name_ta: it.name_ta || null,
      pack_size: it.pack_size || null,
      quantity: Number(it.quantity),
      sell_by: it.sell_by || 'pack',
      unit: it.unit || 'pack',
      price_basis: it.price_basis || 'per_pack',
      ...(hide ? {} : { unit_price: unitPrice, line_total: lineTotal }),
    };
  });
  const subtotal =
    o.subtotal_amount != null
      ? Number(o.subtotal_amount)
      : Math.round(items.reduce((s, l) => s + (l.line_total || 0), 0) * 100) / 100;
  const out = {
    id: o.id,
    order_code: o.order_code,
    shop_slug: o.shop_slug,
    shop_name: o.shop_name || (shop && shop.shop_name) || o.shop_slug,
    status: o.status,
    created_at: o.created_at,
    pending_acceptance_at: o.pending_acceptance_at || null,
    accepted_at: o.accepted_at || null,
    rejected_at: o.rejected_at || null,
    expired_at: o.expired_at || null,
    ready_at: o.ready_at || null,
    collected_at: o.collected_at || null,
    no_show_at: o.no_show_at || null,
    pickup_slot_label: o.pickup_slot_label || 'ASAP',
    pickup_hold_minutes: (shop && shop.pickup_hold_minutes) || o.pickup_hold_minutes || 90,
    acceptance_sla_minutes: (shop && shop.acceptance_sla_minutes) || o.acceptance_sla_minutes || 5,
    prep_time_minutes: (shop && shop.prep_time_minutes) ?? o.prep_time_minutes ?? 10,
    rejection_reason: o.rejection_reason || null,
    price_mode: mode,
    price_pending: hide,
    mine: viewer === 'shopper' || !!o.mine,
    items,
    ...(hide ? {} : { subtotal_amount: subtotal }),
  };
  if (viewer === 'owner') {
    out.customer_name = o.customer_name || `Order ${o.order_code}`;
    out.customer_phone_masked = maskDemoPhone(o.customer_phone);
  }
  return out;
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

/** The onboarded shop, if its slug matches. */
function myShopBySlug(slug) {
  const s = readJson(MYSHOP_KEY);
  return s && s.slug === slug ? s : null;
}

/** Shape a shopkeeper catalog row for the public shopper view per price mode. */
function publicItem(it, mode) {
  const base = {
    id: it.id,
    name: it.name,
    name_ta: it.name_ta ?? null,
    brand: it.brand ?? null,
    category: it.category || 'Uncategorised',
    unit: it.unit ?? null,
    pack_size: it.pack_size ?? null,
    variant_group: it.variant_group ?? null,
    icon: it.icon ?? null,
    stock_amount: Number(it.stock_amount ?? it.stock_qty ?? 0),
    stock_qty: Number(it.stock_amount ?? it.stock_qty ?? 0),
    in_stock: it.is_available && Number(it.stock_amount ?? it.stock_qty ?? 0) > 0,
    sell_by: it.sell_by || 'pack',
    base_unit: it.base_unit || 'pcs',
    price_basis: it.price_basis || (it.sell_by === 'weight' ? 'per_kg' : it.sell_by === 'piece' ? 'per_piece' : 'per_pack'),
    min_qty: it.min_qty ?? null,
    max_qty: it.max_qty ?? null,
    step_qty: it.step_qty ?? null,
    est_unit_weight_g: it.est_unit_weight_g ?? null,
    price_mode: mode,
  };
  if (mode === 'hidden') return base;
  if (mode === 'range') return { ...base, ...priceBand(Number(it.price)) };
  return { ...base, price: Number(it.price) };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}
function saveUser(u) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  } catch {
    /* ignore */
  }
}

function makeUser(phone) {
  return {
    id: 'demo-user',
    phone_number: phone,
    email: null,
    full_name: null,
    area: null,
    latitude: null,
    longitude: null,
    is_phone_verified: true,
    preferred_language: 'en',
    status: 'active',
    consent_version: null, // → triggers the consent screen on first sign-in
    location_consent: false,
    marketing_consent: false,
    created_at: new Date().toISOString(),
  };
}

const fakeTokens = () => ({
  access_token: 'demo.access.token',
  refresh_token: 'demo.refresh.token',
  token_type: 'Bearer',
  expires_in: 900,
});

class MockError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function mockApi(path, { method = 'GET', body } = {}) {
  await wait(250); // a touch of latency so loading states are visible

  const [pathname, qs = ''] = path.split('?');
  const q = new URLSearchParams(qs);

  // ── shopkeeper onboarding (build step 5) ─────────────────────────────
  if (pathname === '/shops' && method === 'POST') {
    const d = body || {};
    const slug = newShopSlug();
    const shop = {
      slug,
      shop_name: d.shop_name,
      category: d.category,
      address: d.address,
      owner_name: d.owner_name,
      phone_number: d.phone_number,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      opening_hours: d.opening_hours ?? null,
      price_display_mode: d.price_display_mode || 'exact',
      price_mode: d.price_display_mode || 'exact',
      is_open: false,
      acceptance_sla_minutes: 5,
      pickup_hold_minutes: 90,
      prep_time_minutes: d.prep_time_minutes ?? 10,
      qr_generated_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(MYSHOP_KEY, JSON.stringify(shop));
    } catch {
      /* ignore */
    }
    return { shop, share_url: shopShareUrl(slug) };
  }

  if (pathname === '/shops/mine' && method === 'GET') {
    let shop = null;
    try {
      shop = JSON.parse(localStorage.getItem(MYSHOP_KEY) || 'null');
    } catch {
      /* ignore */
    }
    return { count: shop ? 1 : 0, shops: shop ? [shop] : [] };
  }

  const patchShopMatch = pathname.match(/^\/shops\/([0-9A-Z]{4,16})$/);
  if (patchShopMatch && method === 'PATCH') {
    const cur = myShopBySlug(patchShopMatch[1]);
    if (!cur) throw new MockError(404, 'SHOP_NOT_FOUND', 'That shop could not be found.');
    const allowed = [
      'shop_name',
      'category',
      'address',
      'owner_name',
      'phone_number',
      'latitude',
      'longitude',
      'opening_hours',
      'price_display_mode',
      'prep_time_minutes',
      'is_open',
    ];
    const next = { ...cur };
    for (const k of allowed) if (body && k in body) next[k] = body[k];
    if ('price_display_mode' in (body || {})) next.price_mode = body.price_display_mode;
    try {
      localStorage.setItem(MYSHOP_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return { shop: next };
  }

  // ── shop discovery + single-shop browsing (build step 2) ──────────────
  if (pathname === '/shops' && method === 'GET') {
    const lat = Number(q.get('lat'));
    const lng = Number(q.get('lng'));
    const radius = Number(q.get('radius_km')) || 5;
    const shops = DEMO_SHOPS.map((s) => ({
      ...s,
      distance_km: Math.round(haversineKm(lat, lng, s.latitude, s.longitude) * 100) / 100,
    }))
      .filter((s) => s.distance_km <= radius)
      .sort((a, b) => Number(b.is_open) - Number(a.is_open) || a.distance_km - b.distance_km);
    return { origin: { lat, lng }, radius_km: radius, count: shops.length, shops };
  }

  const invMatch = pathname.match(/^\/shops\/([0-9A-Z]{4,16})\/inventory$/);
  if (invMatch && method === 'GET') {
    const slug = invMatch[1];
    if (demoShop(slug)) return { items: demoInventory(slug), count: demoInventory(slug).length };
    const mine = myShopBySlug(slug);
    if (!mine) throw new MockError(404, 'SHOP_NOT_FOUND', 'That shop could not be found.');
    const rows = (readJson(CATALOG_KEY) || {})[slug] || [];
    const items = rows.map((it) => publicItem(it, mine.price_display_mode || 'exact'));
    return { count: items.length, items };
  }

  const shopMatch = pathname.match(/^\/shops\/([0-9A-Z]{4,16})$/);
  if (shopMatch && method === 'GET') {
    const shop = demoShop(shopMatch[1]) || myShopBySlug(shopMatch[1]);
    if (!shop) throw new MockError(404, 'SHOP_NOT_FOUND', 'That shop could not be found.');
    return { shop };
  }

  // ── favourite shops ─────────────────────────────────────────────────
  if (pathname === '/shops/favourites' && method === 'GET') {
    const favs = loadFavs();
    // refresh the open/closed + distance snapshot from live demo data
    const fresh = favs.map((f) => {
      const s = demoShop(f.slug) || myShopBySlug(f.slug);
      return s
        ? { slug: s.slug, shop_name: s.shop_name, category: s.category, is_open: s.is_open, distance_km: f.distance_km ?? null }
        : f;
    });
    return { count: fresh.length, shops: fresh };
  }
  const favMatch = pathname.match(/^\/shops\/([0-9A-Z]{4,16})\/favourite$/);
  if (favMatch && (method === 'POST' || method === 'DELETE')) {
    const slug = favMatch[1];
    const shop = demoShop(slug) || myShopBySlug(slug);
    if (!shop) throw new MockError(404, 'SHOP_NOT_FOUND', 'That shop could not be found.');
    let favs = loadFavs().filter((f) => f.slug !== slug);
    if (method === 'POST') {
      favs = [
        { slug: shop.slug, shop_name: shop.shop_name, category: shop.category || null, is_open: shop.is_open ?? null, distance_km: null },
        ...favs,
      ];
    }
    saveFavs(favs);
    return { count: favs.length, shops: favs };
  }

  // ── orders (build step 4, scoped) ────────────────────────────────────
  const shopOrdersMatch = pathname.match(/^\/shops\/([0-9A-Z]{4,16})\/orders$/);
  if (shopOrdersMatch && method === 'POST') {
    const slug = shopOrdersMatch[1];
    const shop = demoShop(slug) || myShopBySlug(slug);
    if (!shop) throw new MockError(404, 'SHOP_NOT_FOUND', 'That shop could not be found.');

    const key = body?.idempotency_key;
    if (!key) throw new MockError(400, 'VALIDATION_ERROR', 'Missing idempotency_key.');
    const all = loadOrders();
    const dupe = all.find((o) => o.idempotency_key && o.idempotency_key === key);
    if (dupe) return { order: serializeOrder(dupe, 'shopper', shop) };

    if (shop.is_open === false) {
      throw new MockError(409, 'SHOP_CLOSED', 'This shop is not taking orders right now.');
    }

    const prices = demoShopPrices(slug);
    const lines = (body?.items || []).map((it) => {
      const row = prices.get(it.item_id);
      if (!row) throw new MockError(400, 'ITEM_NOT_SOLD_HERE', 'One of those items is not sold at this shop.');
      const qty = Number(it.quantity);
      if (!(qty > 0)) throw new MockError(400, 'BAD_QUANTITY', 'Invalid quantity for an item.');
      const unit = Number(row.price);
      return {
        name: row.name,
        name_ta: row.name_ta || null,
        pack_size: row.pack_size || null,
        quantity: qty,
        unit_price: unit,
        sell_by: row.sell_by || 'pack',
        unit:
          row.sell_by === 'weight'
            ? row.base_unit || 'kg'
            : row.sell_by === 'piece'
              ? 'pcs'
              : 'pack',
        price_basis: row.price_basis || 'per_pack',
        line_total: Math.round(unit * qty * 100) / 100,
      };
    });
    if (!lines.length) throw new MockError(400, 'EMPTY_ORDER', 'Your cart is empty.');

    const now = new Date().toISOString();
    const order = {
      id: `o${Date.now()}`,
      order_code: demoOrderCode(),
      shop_slug: slug,
      shop_name: shop.shop_name,
      status: STATUS.PENDING_ACCEPTANCE,
      created_at: now,
      pending_acceptance_at: now,
      pickup_slot_label: body?.pickup_slot_label || 'ASAP',
      idempotency_key: key,
      mine: true,
      customer_name: (loadUser() || {}).full_name || 'You',
      customer_phone: (loadUser() || {}).phone_number || '+9198••••0000',
      items: lines,
      subtotal_amount: Math.round(lines.reduce((s, l) => s + l.line_total, 0) * 100) / 100,
      price_mode: shop.price_display_mode || shop.price_mode || 'exact',
    };
    saveOrders([order, ...all]);
    return { order: serializeOrder(order, 'shopper', shop) };
  }

  if (shopOrdersMatch && method === 'GET') {
    const slug = shopOrdersMatch[1];
    const shop = demoShop(slug) || myShopBySlug(slug);
    if (!shop) throw new MockError(404, 'SHOP_NOT_FOUND', 'That shop could not be found.');
    const { list, changed } = settleExpiry(loadOrders());
    if (changed) saveOrders(list);
    let rows = list.filter((o) => o.shop_slug === slug);
    const status = q.get('status');
    if (status === 'active') rows = rows.filter((o) => ACTIVE.includes(o.status));
    else if (status) rows = rows.filter((o) => o.status === status);
    rows = rows.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return { count: rows.length, orders: rows.map((o) => serializeOrder(o, 'owner', shop)) };
  }

  if (pathname === '/orders/mine' && method === 'GET') {
    const { list, changed } = settleExpiry(loadOrders());
    if (changed) saveOrders(list);
    const rows = list
      .filter((o) => o.mine)
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { count: rows.length, orders: rows.map((o) => serializeOrder(o, 'shopper', shopFor(o.shop_slug))) };
  }

  const oneOrderMatch = pathname.match(/^\/orders\/([^/]+)$/);
  if (oneOrderMatch && method === 'GET') {
    const { list, changed } = settleExpiry(loadOrders());
    if (changed) saveOrders(list);
    const o = list.find((x) => x.id === oneOrderMatch[1]);
    if (!o) throw new MockError(404, 'ORDER_NOT_FOUND', 'That order could not be found.');
    return { order: serializeOrder(o, o.mine ? 'shopper' : 'owner', shopFor(o.shop_slug)) };
  }

  const transMatch = pathname.match(/^\/orders\/([^/]+)\/transitions$/);
  if (transMatch && method === 'POST') {
    const all = loadOrders();
    const idx = all.findIndex((o) => o.id === transMatch[1]);
    if (idx < 0) throw new MockError(404, 'ORDER_NOT_FOUND', 'That order could not be found.');

    let o = all[idx];
    const placed = Date.parse(o.pending_acceptance_at || o.created_at);
    if (isExpired(o.status, placed, DEMO_SLA_MIN)) {
      o = { ...o, status: STATUS.EXPIRED, expired_at: new Date().toISOString() };
      all[idx] = o;
    }

    const action = body?.action;
    const t = TRANSITIONS[action];
    if (!t) throw new MockError(400, 'UNKNOWN_ACTION', 'Unknown order action.');
    if (action === 'reject' && !body?.reason) {
      throw new MockError(400, 'REASON_REQUIRED', 'A reason is required to reject an order.');
    }
    const to = nextStatus(o.status, action);
    if (!to) {
      throw new MockError(409, 'ILLEGAL_TRANSITION', `Cannot ${action} an order that is ${o.status}.`);
    }
    const next = {
      ...o,
      status: to,
      [t.stamp]: new Date().toISOString(),
      ...(action === 'reject' ? { rejection_reason: body.reason } : {}),
    };
    all[idx] = next;
    saveOrders(all);
    return { order: serializeOrder(next, 'owner', shopFor(next.shop_slug)) };
  }

  // ── account rights (DPDP): consent, export, delete ──────────────────
  if (pathname === '/users/me/consent' && method === 'POST') {
    const u = loadUser();
    if (!u) throw new MockError(401, 'UNAUTHORIZED', 'Authentication required');
    const next = {
      ...u,
      consent_version: body?.consent_version || null,
      location_consent: !!body?.location,
      marketing_consent: !!body?.marketing,
    };
    saveUser(next);
    return { user: next };
  }

  if (pathname === '/users/me/export' && method === 'GET') {
    const u = loadUser();
    if (!u) throw new MockError(401, 'UNAUTHORIZED', 'Authentication required');
    return {
      exported_at: new Date().toISOString(),
      profile: u,
      consents: [],
      orders: [],
      order_items: [],
      wishlist: [],
      favourite_shops: loadFavs(),
      notifications: [],
      security_events: [],
      _note: 'Demo export — the real backend returns your full order & consent history.',
    };
  }

  if (pathname === '/users/me' && method === 'DELETE') {
    if (body?.confirm !== 'DELETE') throw new MockError(400, 'VALIDATION_ERROR', 'Type DELETE to confirm.');
    localStorage.removeItem(USER_KEY);
    return null;
  }

  if (pathname === '/auth/otp/request' && method === 'POST') {
    return { request_id: 'demo', expires_at: new Date(Date.now() + 300000).toISOString(), dev_otp: DEMO_OTP };
  }

  if (pathname === '/auth/otp/verify' && method === 'POST') {
    if (body?.otp_code !== DEMO_OTP) {
      throw new MockError(400, 'OTP_INVALID', 'That code is not correct.');
    }
    const existing = loadUser();
    const user = existing?.phone_number === body.phone_number ? existing : makeUser(body.phone_number);
    saveUser(user);
    return { ...fakeTokens(), user, is_new_user: !existing };
  }

  if (pathname === '/auth/refresh' && method === 'POST') {
    const user = loadUser();
    if (!user) throw new MockError(401, 'REFRESH_INVALID', 'Please sign in again.');
    return { ...fakeTokens(), user };
  }

  if (pathname === '/auth/me' && method === 'GET') {
    const user = loadUser();
    if (!user) throw new MockError(401, 'UNAUTHORIZED', 'Authentication required');
    return { user };
  }

  if (pathname === '/users/me' && method === 'PATCH') {
    const user = { ...loadUser(), ...body };
    if (user.email === '') user.email = null;
    saveUser(user);
    return { user };
  }

  if (pathname === '/auth/logout' && method === 'POST') {
    localStorage.removeItem(USER_KEY);
    return null;
  }

  throw new MockError(404, 'NOT_FOUND', `No demo handler for ${method} ${path}`);
}
