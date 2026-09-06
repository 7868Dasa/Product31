/**
 * Starter master catalog. Small on purpose — the real catalog is curated
 * centrally later (spec §5).
 *
 * Covers all three `sell_by` modes so the voice + cart paths have real data:
 *   - pack   : Aachi Chicken Masala (3 sizes, one variant_group — §9.2 test),
 *              Aavin Milk, Tata Salt, Boost, Bru Coffee, Marie Biscuit
 *   - weight : Idli Rice, Toor Dal, Sugar (per kg); Sunflower Oil (per l)
 *   - piece  : Coconut (weight varies; ~400 g each)
 *
 * `default_sell_by` is only a hint — each shop overrides it in shop_inventory.
 */

/** @param {import('knex').Knex} knex */
export async function seed(knex) {
  await knex('master_products').del();

  await knex('master_products').insert([
    // ── variant group: Aachi Chicken Masala (50g / 100g / 1kg) ──────────
    { name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', brand: 'Aachi', category: 'Masala & Spices', unit: 'g', variant_group: 'aachi-chicken-masala', pack_size: '50g', default_sell_by: 'pack', base_unit: 'pcs', net_weight_value: 50, net_weight_unit: 'g', icon: '🍗' },
    { name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', brand: 'Aachi', category: 'Masala & Spices', unit: 'g', variant_group: 'aachi-chicken-masala', pack_size: '100g', default_sell_by: 'pack', base_unit: 'pcs', net_weight_value: 100, net_weight_unit: 'g', icon: '🍗' },
    { name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', brand: 'Aachi', category: 'Masala & Spices', unit: 'kg', variant_group: 'aachi-chicken-masala', pack_size: '1kg', default_sell_by: 'pack', base_unit: 'pcs', net_weight_value: 1, net_weight_unit: 'kg', icon: '🍗' },

    // ── pack (single size) ────────────────────────────────────────────
    { name: 'Aavin Milk', name_ta: 'ஆவின் பால்', brand: 'Aavin', category: 'Dairy', unit: 'ml', pack_size: '500ml', default_sell_by: 'pack', base_unit: 'pcs', net_weight_value: 500, net_weight_unit: 'ml', icon: '🥛' },
    { name: 'Tata Salt', name_ta: 'டாடா உப்பு', brand: 'Tata', category: 'Essentials', unit: 'kg', pack_size: '1kg', default_sell_by: 'pack', base_unit: 'pcs', net_weight_value: 1, net_weight_unit: 'kg', icon: '🧂' },
    { name: 'Boost', name_ta: 'பூஸ்ட்', brand: 'Boost', category: 'Beverages', unit: 'g', pack_size: '500g', default_sell_by: 'pack', base_unit: 'pcs', net_weight_value: 500, net_weight_unit: 'g', icon: '🥤' },
    { name: 'Bru Coffee', name_ta: 'புரு காபி', brand: 'Bru', category: 'Beverages', unit: 'g', pack_size: '100g', default_sell_by: 'pack', base_unit: 'pcs', net_weight_value: 100, net_weight_unit: 'g', icon: '☕' },
    { name: 'Marie Biscuit', name_ta: 'மேரி பிஸ்கட்', brand: 'Britannia', category: 'Snacks', unit: 'g', pack_size: '150g', default_sell_by: 'pack', base_unit: 'pcs', net_weight_value: 150, net_weight_unit: 'g', icon: '🍪' },

    // ── weight (loose, sold per kg / per l) ──────────────────────────
    { name: 'Idli Rice', name_ta: 'இட்லி அரிசி', brand: null, category: 'Rice & Grains', unit: 'kg', pack_size: null, default_sell_by: 'weight', base_unit: 'kg', icon: '🍚' },
    { name: 'Toor Dal', name_ta: 'துவரம் பருப்பு', brand: null, category: 'Pulses', unit: 'kg', pack_size: null, default_sell_by: 'weight', base_unit: 'kg', icon: '🫘' },
    { name: 'Sugar', name_ta: 'சர்க்கரை', brand: null, category: 'Essentials', unit: 'kg', pack_size: null, default_sell_by: 'weight', base_unit: 'kg', icon: '🍬' },
    { name: 'Sunflower Oil', name_ta: 'சூரியகாந்தி எண்ணெய்', brand: null, category: 'Oil & Ghee', unit: 'l', pack_size: null, default_sell_by: 'weight', base_unit: 'l', icon: '🛢️' },

    // ── piece (weight varies) ───────────────────────────────────────
    { name: 'Coconut', name_ta: 'தேங்காய்', brand: null, category: 'Fresh', unit: 'pcs', pack_size: null, default_sell_by: 'piece', base_unit: 'pcs', icon: '🥥' },
  ]);
}
