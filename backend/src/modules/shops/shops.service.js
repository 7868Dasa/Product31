/**
 * Shop discovery + single-shop browsing (spec build step 2).
 *
 * Hard rule from the motto: browsing is ALWAYS scoped to one shop. There is
 * no endpoint that returns products from more than one shop, and no
 * price-comparison surface anywhere.
 */
import { db } from '../../db.js';
import { notFound, conflict, forbidden } from '../../lib/errors.js';
import { newShopSlug } from '../../lib/ids.js';

const SHOP_FIELDS = [
  'id',
  'slug',
  'shop_name',
  'owner_name',
  'category',
  'address',
  'latitude',
  'longitude',
  'is_open',
  'acceptance_sla_minutes',
  'pickup_hold_minutes',
  'price_display_mode',
  'opening_hours',
  'qr_generated_at',
];

/** Round a price into a friendly band (nearest ₹5, roughly ±12%). */
export function priceBand(price) {
  const step = 5;
  const lo = Math.max(step, Math.round((price * 0.88) / step) * step);
  const hi = Math.round((price * 1.12) / step) * step;
  return { price_min: lo, price_max: Math.max(hi, lo + step) };
}

/** Shape an inventory row for the PUBLIC shopper view per the shop's mode. */
function publicInventoryItem(it, mode) {
  const sellBy = it.sell_by || it.default_sell_by || 'pack';
  const base = {
    id: it.id,
    name: it.name,
    name_ta: it.name_ta,
    brand: it.brand,
    category: it.category,
    unit: it.unit,
    pack_size: it.pack_size,
    variant_group: it.variant_group,
    icon: it.icon,
    thumb_url: it.thumb_url,
    image_url: it.image_url,
    in_stock: it.is_available && Number(it.stock_amount ?? it.stock_qty ?? 0) > 0,
    stock_amount: Number(it.stock_amount ?? it.stock_qty ?? 0),
    // ── how this shop sells it (migration 0005) ──────────────────────────
    sell_by: sellBy, // 'pack' | 'weight' | 'piece'
    price_basis: it.price_basis || (sellBy === 'weight' ? 'per_kg' : sellBy === 'piece' ? 'per_piece' : 'per_pack'),
    base_unit: it.base_unit || 'pcs',
    min_qty: it.min_qty != null ? Number(it.min_qty) : null,
    max_qty: it.max_qty != null ? Number(it.max_qty) : null,
    step_qty: it.step_qty != null ? Number(it.step_qty) : null,
    est_unit_weight_g: it.est_unit_weight_g != null ? Number(it.est_unit_weight_g) : null,
    price_mode: mode,
  };
  if (mode === 'hidden') return base;
  if (mode === 'range') return { ...base, ...priceBand(Number(it.price)) };
  return { ...base, price: Number(it.price) };
}

// Haversine in SQL (km). Clamp the acos arg to [-1, 1] for float safety.
const DISTANCE_SQL = `
  6371 * acos(least(1, greatest(-1,
    cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?))
    + sin(radians(?)) * sin(radians(latitude))
  )))
`;

function shapeShop(row) {
  const out = {};
  for (const f of SHOP_FIELDS) out[f] = row[f];
  // expose under a shorter key too, for the client
  out.price_mode = row.price_display_mode;
  if (row.distance_km != null) out.distance_km = Math.round(Number(row.distance_km) * 100) / 100;
  return out;
}

export async function findNearbyShops({ lat, lng, radius_km }) {
  const inner = db('shops')
    .select('*')
    .select(db.raw(`${DISTANCE_SQL} as distance_km`, [lat, lng, lat]))
    .whereNotNull('latitude')
    .whereNotNull('longitude');

  const rows = await db
    .from(inner.as('s'))
    .where('distance_km', '<=', radius_km)
    .orderBy([
      { column: 'is_open', order: 'desc' }, // open shops first
      { column: 'distance_km', order: 'asc' },
    ])
    .limit(50);

  return rows.map(shapeShop);
}

export async function getShopBySlug(slug) {
  const row = await db('shops').where({ slug }).first();
  if (!row) throw notFound('SHOP_NOT_FOUND', 'That shop could not be found.');
  return shapeShop(row);
}

export async function listShopsOwnedBy(userId) {
  const rows = await db('shops').where({ owner_user_id: userId }).orderBy('created_at', 'asc');
  return rows.map(shapeShop);
}

/** Self-service onboarding (spec §5). Generates a non-guessable slug (§4/§8). */
export async function createShop(ownerUserId, data) {
  let slug = null;
  for (let i = 0; i < 6; i += 1) {
    const candidate = newShopSlug();
    // eslint-disable-next-line no-await-in-loop
    const clash = await db('shops').where({ slug: candidate }).first();
    if (!clash) {
      slug = candidate;
      break;
    }
  }
  if (!slug) throw conflict('SLUG_ALLOC_FAILED', 'Could not allocate a shop link. Try again.');

  const [row] = await db('shops')
    .insert({
      owner_user_id: ownerUserId,
      shop_name: data.shop_name,
      category: data.category,
      address: data.address,
      owner_name: data.owner_name,
      phone_number: data.phone_number,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      opening_hours: data.opening_hours ?? null,
      price_display_mode: data.price_display_mode ?? 'exact',
      slug,
      qr_generated_at: db.fn.now(),
      is_open: false, // shop starts closed until the owner flips it
    })
    .returning('*');

  return shapeShop(row);
}

/** Owner edits their shop (name, hours, price mode, open/closed, …). */
export async function updateShop(ownerUserId, slug, patch) {
  const shop = await db('shops').where({ slug }).first();
  if (!shop) throw notFound('SHOP_NOT_FOUND', 'That shop could not be found.');
  if (shop.owner_user_id !== ownerUserId) {
    throw forbidden('NOT_SHOP_OWNER', 'This is not your shop.');
  }
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
    'is_open',
  ];
  const fields = {};
  for (const k of allowed) if (k in patch) fields[k] = patch[k];
  if (!Object.keys(fields).length) return shapeShop(shop);

  const [row] = await db('shops').where({ id: shop.id }).update(fields).returning('*');
  return shapeShop(row);
}

export async function getShopInventory(slug) {
  const shop = await db('shops').where({ slug }).first();
  if (!shop) throw notFound('SHOP_NOT_FOUND', 'That shop could not be found.');

  const items = await db('shop_inventory as si')
    .join('master_products as mp', 'mp.id', 'si.product_id')
    .where('si.shop_id', shop.id)
    .select(
      'si.id',
      'si.price',
      'si.stock_amount',
      'si.is_available',
      'si.sell_by',
      'si.price_basis',
      'si.min_qty',
      'si.max_qty',
      'si.step_qty',
      'si.est_unit_weight_g',
      'mp.name',
      'mp.name_ta',
      'mp.brand',
      'mp.category',
      'mp.unit',
      'mp.pack_size',
      'mp.variant_group',
      'mp.default_sell_by',
      'mp.base_unit',
      'mp.icon',
      'mp.thumb_url',
      'mp.image_url',
    )
    .orderBy([
      { column: 'mp.category', order: 'asc' },
      { column: 'mp.name', order: 'asc' },
      { column: 'mp.pack_size', order: 'asc' },
    ]);

  return items.map((it) => publicInventoryItem(it, shop.price_display_mode));
}
