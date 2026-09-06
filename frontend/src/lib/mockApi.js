/**
 * Frontend-only demo shim. When VITE_DEMO=true, api() routes here instead of
 * hitting the backend, so the UI is fully clickable with NO server and NO
 * database. This is throwaway scaffolding for previewing screens — it is not
 * the real auth flow and never ships to production.
 *
 * Dummy credentials: any 10-digit number, OTP code is always 123456.
 */
import { haversineKm } from './geo.js';
import { DEMO_SHOPS, demoShop, demoInventory } from './mockData.js';
import { newShopSlug } from './slug.js';
import { shopShareUrl } from './qr.js';
import { priceBand } from './price.js';

const DEMO_OTP = '123456';
const USER_KEY = 'p31.demo.user';
const MYSHOP_KEY = 'p31.demo.myshop';
const CATALOG_KEY = 'p31.demo.catalog';

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
