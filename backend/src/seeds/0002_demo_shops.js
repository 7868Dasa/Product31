/**
 * Demo shops + inventory around Kallakurichi, Tamil Nadu, so shop discovery
 * and single-shop browsing work on a fresh database.
 *
 * Each row carries `sell_by` (pack | weight | piece) so the voice + cart paths
 * have real mixed data. Weight rows price per kg / per l; piece rows per piece.
 *
 * Idempotent: only touches the demo owner (by phone) and shops with these
 * fixed slugs. Remove once real shopkeepers onboard.
 */
const DEMO_OWNER_PHONE = '+919000000001';

// category values come from the canonical list in
// frontend/src/lib/categories.js — keep the two in sync.
const SHOPS = [
  { slug: 'MRGNKLKI', shop_name: 'Sri Murugan Stores', owner_name: 'R. Murugan', category: 'Kirana / Grocery', address: 'Gandhi Road, Kallakurichi', latitude: 11.7415, longitude: 78.9603, is_open: true, price_display_mode: 'exact' },
  { slug: 'AMMAKLKI', shop_name: 'Amma Super Mart', owner_name: 'S. Selvi', category: 'Supermarket', address: 'Salem Main Road, Kallakurichi', latitude: 11.7365, longitude: 78.955, is_open: true, price_display_mode: 'range' },
  { slug: 'LXMIKLKI', shop_name: 'Lakshmi Provisions', owner_name: 'K. Lakshmi', category: 'Kirana / Grocery', address: 'Bus Stand Road, Kallakurichi', latitude: 11.748, longitude: 78.967, is_open: false, price_display_mode: 'hidden' },
  { slug: 'GNSHKLKI', shop_name: 'New Ganesh Traders', owner_name: 'V. Ganesan', category: 'Wholesale & Retail', address: 'Chinnasalem Road, Kallakurichi', latitude: 11.76, longitude: 78.972, is_open: true, price_display_mode: 'exact' },
  { slug: 'BRTIKLKI', shop_name: 'Bharathi Mini Mart', owner_name: 'M. Bharathi', category: 'Supermarket', address: 'Ulundurpet Road, Kallakurichi', latitude: 11.715, longitude: 78.94, is_open: true, price_display_mode: 'range' },
  { slug: 'KOVLKLKI', shop_name: 'Kovil Kadai', owner_name: 'P. Anand', category: 'Kirana / Grocery', address: 'Melmalayanur Road', latitude: 11.81, longitude: 79.01, is_open: true, price_display_mode: 'hidden' },
  { slug: 'SRVNKLKI', shop_name: 'Saravana Bakery', owner_name: 'B. Saravanan', category: 'Bakery', address: 'Trichy Road, Kallakurichi', latitude: 11.739, longitude: 78.964, is_open: true, price_display_mode: 'exact' },
  { slug: 'ANNMKLKI', shop_name: 'Annam Tea Stall', owner_name: 'D. Kumar', category: 'Tea Shop', address: 'Railway Feeder Road, Kallakurichi', latitude: 11.744, longitude: 78.958, is_open: true, price_display_mode: 'exact' },
];

const WEIGHT_DEFAULTS = { min_qty: 0.25, max_qty: 10, step_qty: 0.25 };

// [name, pack_size|null, price, stock_amount]
// pack_size is only meaningful for the Aachi variant rows; weight/piece use null.
const INVENTORY = {
  MRGNKLKI: [
    ['Aachi Chicken Masala', '50g', 22, 40],
    ['Aachi Chicken Masala', '100g', 40, 25],
    ['Aachi Chicken Masala', '1kg', 340, 6],
    ['Aavin Milk', '500ml', 28, 30],
    ['Tata Salt', '1kg', 28, 40],
    ['Bru Coffee', '100g', 95, 10],
    ['Marie Biscuit', '150g', 30, 22],
    ['Idli Rice', null, 62, 80], // ₹/kg
    ['Toor Dal', null, 145, 55], // ₹/kg
    ['Sugar', null, 45, 60], // ₹/kg
    ['Sunflower Oil', null, 155, 40], // ₹/l
    ['Coconut', null, 35, 60], // ₹/piece
  ],
  AMMAKLKI: [
    ['Aachi Chicken Masala', '100g', 42, 0], // out of stock
    ['Aavin Milk', '500ml', 27, 60],
    ['Tata Salt', '1kg', 27, 55],
    ['Boost', '500g', 245, 8],
    ['Marie Biscuit', '150g', 29, 30],
    ['Idli Rice', null, 60, 120],
    ['Toor Dal', null, 142, 40],
    ['Sugar', null, 44, 70],
    ['Sunflower Oil', null, 152, 55],
  ],
  LXMIKLKI: [
    ['Tata Salt', '1kg', 29, 15],
    ['Idli Rice', null, 64, 30],
    ['Toor Dal', null, 148, 18],
    ['Sugar', null, 46, 22],
  ],
  GNSHKLKI: [
    ['Tata Salt', '1kg', 26, 120],
    ['Idli Rice', null, 58, 300],
    ['Toor Dal', null, 138, 90],
    ['Sugar', null, 42, 140],
    ['Sunflower Oil', null, 149, 80],
    ['Coconut', null, 32, 200],
  ],
  BRTIKLKI: [
    ['Aavin Milk', '500ml', 28, 15],
    ['Bru Coffee', '100g', 98, 6],
    ['Marie Biscuit', '150g', 31, 12],
    ['Boost', '500g', 250, 3], // low stock
    ['Tata Salt', '1kg', 28, 10],
  ],
  KOVLKLKI: [
    ['Aavin Milk', '500ml', 29, 10],
    ['Idli Rice', null, 65, 25],
    ['Sugar', null, 47, 12],
  ],
  // Bakery / Tea shops reuse existing master products for now; add bakery/tea
  // SKUs to 0001_master_products.js when the DB is wired for a richer demo
  // (the frontend VITE_DEMO fixtures already carry bread / bun / tea powder).
  SRVNKLKI: [
    ['Marie Biscuit', '150g', 30, 24],
    ['Aavin Milk', '500ml', 28, 15],
    ['Bru Coffee', '100g', 96, 8],
  ],
  ANNMKLKI: [
    ['Bru Coffee', '100g', 95, 12],
    ['Marie Biscuit', '150g', 30, 20],
    ['Aavin Milk', '500ml', 27, 18],
  ],
};

/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  const slugs = SHOPS.map((s) => s.slug);
  await knex('shops').whereIn('slug', slugs).del(); // cascades shop_inventory

  const [owner] = await knex('users')
    .insert({ phone_number: DEMO_OWNER_PHONE, full_name: 'Demo Shopkeeper', is_phone_verified: true })
    .onConflict('phone_number')
    .merge({ full_name: 'Demo Shopkeeper' })
    .returning('id');

  const products = await knex('master_products').select(
    'id',
    'name',
    'pack_size',
    'default_sell_by',
    'base_unit',
  );
  const findProduct = (name, pack) =>
    products.find((p) => p.name === name && (pack ? p.pack_size === pack : p.pack_size == null)) ||
    products.find((p) => p.name === name);

  const basisFor = (sellBy, baseUnit) => {
    if (sellBy === 'weight') return baseUnit === 'l' ? 'per_l' : 'per_kg';
    if (sellBy === 'piece') return 'per_piece';
    return 'per_pack';
  };

  for (const s of SHOPS) {
    const [shop] = await knex('shops')
      .insert({ ...s, owner_user_id: owner.id, phone_number: DEMO_OWNER_PHONE })
      .returning('id');

    const rows = (INVENTORY[s.slug] || [])
      .map(([name, pack, price, qty]) => {
        const prod = findProduct(name, pack);
        if (!prod) return null;
        const sell_by = prod.default_sell_by;
        return {
          shop_id: shop.id,
          product_id: prod.id,
          price,
          stock_amount: qty,
          is_available: qty > 0,
          sell_by,
          price_basis: basisFor(sell_by, prod.base_unit),
          ...(sell_by === 'weight' ? WEIGHT_DEFAULTS : {}),
          ...(sell_by === 'piece' ? { est_unit_weight_g: 400 } : {}),
        };
      })
      .filter(Boolean);

    if (rows.length) await knex('shop_inventory').insert(rows);
  }
}
