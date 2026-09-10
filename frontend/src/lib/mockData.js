/**
 * Demo fixtures for VITE_DEMO mode — mirrors backend/src/seeds so the frontend
 * behaves the same with or without a real backend. Carries `sell_by`
 * (pack | weight | piece) per shop_inventory row (migration 0005).
 */
import { priceBand } from './price.js';

// identity + how it's sold by default
const P = {
  chicken: { name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', brand: 'Aachi', category: 'Masala & Spices', unit: 'g', icon: '🍗', variant_group: 'aachi-chicken-masala', sell_by: 'pack', base_unit: 'pcs' },
  milk: { name: 'Aavin Milk', name_ta: 'ஆவின் பால்', brand: 'Aavin', category: 'Dairy', unit: 'ml', icon: '🥛', variant_group: 'aavin-milk', sell_by: 'pack', base_unit: 'pcs' },
  salt: { name: 'Tata Salt', name_ta: 'டாடா உப்பு', brand: 'Tata', category: 'Essentials', unit: 'kg', icon: '🧂', sell_by: 'pack', base_unit: 'pcs' },
  boost: { name: 'Boost', name_ta: 'பூஸ்ட்', brand: 'Boost', category: 'Beverages', unit: 'g', icon: '🥤', sell_by: 'pack', base_unit: 'pcs' },
  bru: { name: 'Bru Coffee', name_ta: 'புரு காபி', brand: 'Bru', category: 'Beverages', unit: 'g', icon: '☕', sell_by: 'pack', base_unit: 'pcs' },
  marie: { name: 'Marie Biscuit', name_ta: 'மேரி பிஸ்கட்', brand: 'Britannia', category: 'Snacks', unit: 'g', icon: '🍪', sell_by: 'pack', base_unit: 'pcs' },
  rice: { name: 'Idli Rice', name_ta: 'இட்லி அரிசி', brand: null, category: 'Rice & Grains', unit: 'kg', icon: '🍚', sell_by: 'weight', base_unit: 'kg' },
  dal: { name: 'Toor Dal', name_ta: 'துவரம் பருப்பு', brand: null, category: 'Pulses', unit: 'kg', icon: '🫘', sell_by: 'weight', base_unit: 'kg' },
  sugar: { name: 'Sugar', name_ta: 'சர்க்கரை', brand: null, category: 'Essentials', unit: 'kg', icon: '🍬', sell_by: 'weight', base_unit: 'kg' },
  oil: { name: 'Sunflower Oil', name_ta: 'சூரியகாந்தி எண்ணெய்', brand: null, category: 'Oil & Ghee', unit: 'l', icon: '🛢️', sell_by: 'weight', base_unit: 'l' },
  coconut: { name: 'Coconut', name_ta: 'தேங்காய்', brand: null, category: 'Fresh', unit: 'pcs', icon: '🥥', sell_by: 'piece', base_unit: 'pcs' },
  bread: { name: 'Milk Bread', name_ta: 'மில்க் பிரெட்', brand: 'Modern', category: 'Bakery', unit: 'g', icon: '🍞', sell_by: 'pack', base_unit: 'pcs' },
  bun: { name: 'Cream Bun', name_ta: 'கிரீம் பன்', brand: null, category: 'Bakery', unit: 'pcs', icon: '🥐', sell_by: 'piece', base_unit: 'pcs' },
  cake: { name: 'Plum Cake Slice', name_ta: 'பிளம் கேக்', brand: null, category: 'Bakery', unit: 'pcs', icon: '🍰', sell_by: 'piece', base_unit: 'pcs' },
  teapowder: { name: 'Tea Powder', name_ta: 'தேயிலைத் தூள்', brand: null, category: 'Tea & Coffee', unit: 'kg', icon: '🍵', sell_by: 'weight', base_unit: 'kg' },
  teacup: { name: 'Hot Tea', name_ta: 'சூடான டீ', brand: null, category: 'Tea & Coffee', unit: 'pcs', icon: '🫖', sell_by: 'piece', base_unit: 'pcs' },
};

export const DEMO_SHOPS = [
  { slug: 'MRGNKLKI', shop_name: 'Sri Murugan Stores', owner_name: 'R. Murugan', category: 'Grocery', address: 'Gandhi Road, Kallakurichi', latitude: 11.7415, longitude: 78.9603, is_open: true, acceptance_sla_minutes: 5, pickup_hold_minutes: 90, price_display_mode: 'exact', price_mode: 'exact' },
  { slug: 'AMMAKLKI', shop_name: 'Amma Super Mart', owner_name: 'S. Selvi', category: 'Supermarket', address: 'Salem Main Road, Kallakurichi', latitude: 11.7365, longitude: 78.955, is_open: true, acceptance_sla_minutes: 5, pickup_hold_minutes: 90, price_display_mode: 'range', price_mode: 'range' },
  { slug: 'LXMIKLKI', shop_name: 'Lakshmi Provisions', owner_name: 'K. Lakshmi', category: 'Grocery', address: 'Bus Stand Road, Kallakurichi', latitude: 11.748, longitude: 78.967, is_open: false, acceptance_sla_minutes: 5, pickup_hold_minutes: 90, price_display_mode: 'hidden', price_mode: 'hidden' },
  { slug: 'GNSHKLKI', shop_name: 'New Ganesh Traders', owner_name: 'V. Ganesan', category: 'Retail', address: 'Chinnasalem Road, Kallakurichi', latitude: 11.76, longitude: 78.972, is_open: true, acceptance_sla_minutes: 5, pickup_hold_minutes: 90, price_display_mode: 'exact', price_mode: 'exact' },
  { slug: 'BRTIKLKI', shop_name: 'Bharathi Mini Mart', owner_name: 'M. Bharathi', category: 'Supermarket', address: 'Ulundurpet Road, Kallakurichi', latitude: 11.715, longitude: 78.94, is_open: true, acceptance_sla_minutes: 5, pickup_hold_minutes: 90, price_display_mode: 'range', price_mode: 'range' },
  { slug: 'KOVLKLKI', shop_name: 'Kovil Kadai', owner_name: 'P. Anand', category: 'Grocery', address: 'Melmalayanur Road', latitude: 11.81, longitude: 79.01, is_open: true, acceptance_sla_minutes: 5, pickup_hold_minutes: 90, price_display_mode: 'hidden', price_mode: 'hidden' },
  { slug: 'SRVNKLKI', shop_name: 'Saravana Bakery', owner_name: 'B. Saravanan', category: 'Bakery', address: 'Trichy Road, Kallakurichi', latitude: 11.739, longitude: 78.964, is_open: true, acceptance_sla_minutes: 5, pickup_hold_minutes: 90, price_display_mode: 'exact', price_mode: 'exact' },
  { slug: 'ANNMKLKI', shop_name: 'Annam Tea Stall', owner_name: 'D. Kumar', category: 'Tea Shop', address: 'Railway Feeder Road, Kallakurichi', latitude: 11.744, longitude: 78.958, is_open: true, acceptance_sla_minutes: 5, pickup_hold_minutes: 90, price_display_mode: 'exact', price_mode: 'exact' },
];

const WEIGHT_EXTRAS = { min_qty: 0.25, max_qty: 10, step_qty: 0.25 };

// [productKey, pack_size|null, price, stock_amount]  — weight rows price per kg/l
const RAW_INVENTORY = {
  MRGNKLKI: [
    ['chicken', '50g', 22, 40], ['chicken', '100g', 40, 25], ['chicken', '1kg', 340, 6],
    ['milk', '500ml', 28, 30], ['milk', '1L', 54, 18],
    ['salt', '1kg', 28, 40], ['bru', '100g', 95, 10], ['marie', '150g', 30, 22],
    ['rice', null, 62, 80], ['dal', null, 145, 55], ['sugar', null, 45, 60], ['oil', null, 155, 40],
    ['coconut', null, 35, 60],
  ],
  AMMAKLKI: [
    ['chicken', '100g', 42, 0], ['milk', '500ml', 27, 60], ['milk', '1L', 52, 24], ['salt', '1kg', 27, 55],
    ['boost', '500g', 245, 8], ['marie', '150g', 29, 30],
    ['rice', null, 60, 120], ['dal', null, 142, 40], ['sugar', null, 44, 70], ['oil', null, 152, 55],
  ],
  LXMIKLKI: [
    ['salt', '1kg', 29, 15], ['rice', null, 64, 30], ['dal', null, 148, 18], ['sugar', null, 46, 22],
  ],
  GNSHKLKI: [
    ['salt', '1kg', 26, 120], ['rice', null, 58, 300], ['dal', null, 138, 90],
    ['sugar', null, 42, 140], ['oil', null, 149, 80], ['coconut', null, 32, 200],
  ],
  BRTIKLKI: [
    ['milk', '500ml', 28, 15], ['milk', '1L', 55, 6], ['bru', '100g', 98, 6], ['marie', '150g', 31, 12],
    ['boost', '500g', 250, 3], ['salt', '1kg', 28, 10],
  ],
  KOVLKLKI: [
    ['milk', '500ml', 29, 10], ['rice', null, 65, 25], ['sugar', null, 47, 12],
  ],
  SRVNKLKI: [
    ['bread', '400g', 45, 24], ['bun', null, 12, 40], ['cake', null, 30, 18],
    ['marie', '150g', 30, 20], ['milk', '500ml', 28, 12], ['milk', '1L', 55, 8],
  ],
  ANNMKLKI: [
    ['teacup', null, 12, 200], ['teapowder', null, 320, 8],
    ['bru', '100g', 96, 6], ['bun', null, 12, 25], ['marie', '150g', 30, 15],
  ],
};

function basisFor(key) {
  const s = P[key].sell_by;
  if (s === 'weight') return P[key].base_unit === 'l' ? 'per_l' : 'per_kg';
  if (s === 'piece') return 'per_piece';
  return 'per_pack';
}

function shapeRow(slug, key, pack, qty) {
  const { variant_group, sell_by, base_unit, ...ident } = P[key];
  return {
    id: `${slug}-${key}-${pack || 'loose'}`,
    ...ident,
    variant_group: variant_group ?? null,
    pack_size: pack,
    stock_amount: qty,
    stock_qty: qty, // alias during transition
    in_stock: qty > 0,
    is_available: qty > 0,
    sell_by,
    base_unit,
    price_basis: basisFor(key),
    ...(sell_by === 'weight' ? WEIGHT_EXTRAS : {}),
    ...(sell_by === 'piece' ? { est_unit_weight_g: 400 } : {}),
  };
}

export function demoInventory(slug) {
  const mode = (demoShop(slug) || {}).price_display_mode || 'exact';
  return (RAW_INVENTORY[slug] || []).map(([key, pack, price, qty]) => {
    const base = { ...shapeRow(slug, key, pack, qty), price_mode: mode };
    if (mode === 'hidden') return base;
    if (mode === 'range') return { ...base, ...priceBand(price) };
    return { ...base, price };
  });
}

/** Full inventory incl. exact prices — for the shopkeeper's own dashboard. */
export function demoInventoryFull(slug) {
  return (RAW_INVENTORY[slug] || []).map(([key, pack, price, qty]) => ({
    ...shapeRow(slug, key, pack, qty),
    price,
  }));
}

export function demoShop(slug) {
  return DEMO_SHOPS.find((s) => s.slug === slug) || null;
}
