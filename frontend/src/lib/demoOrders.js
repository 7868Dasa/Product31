/**
 * Seed orders for the demo shopkeeper (owns Sri Murugan Stores / MRGNKLKI).
 * Real orders arrive from the backend once build steps 3-4 are done; this
 * feeds the shopkeeper dashboard in VITE_DEMO mode.
 */
const now = Date.now();
const ago = (min) => new Date(now - min * 60_000).toISOString();

export function seedDemoOrders() {
  return [
    {
      id: 'o1',
      order_code: 'B4K9',
      shop_slug: 'MRGNKLKI',
      status: 'PENDING_ACCEPTANCE',
      created_at: ago(1),
      pending_acceptance_at: ago(1),
      customer_name: 'Anitha R.',
      customer_phone: '+9198••••3210',
      pickup_slot_label: 'ASAP',
      items: [
        { name: 'Aavin Milk', name_ta: 'ஆவின் பால்', pack_size: '500ml', quantity: 2, unit_price: 28 },
        { name: 'Marie Biscuit', name_ta: 'மேரி பிஸ்கட்', pack_size: '150g', quantity: 1, unit_price: 30 },
      ],
      subtotal_amount: 86,
    },
    {
      id: 'o2',
      order_code: 'M2P7',
      shop_slug: 'MRGNKLKI',
      status: 'PENDING_ACCEPTANCE',
      created_at: ago(4),
      pending_acceptance_at: ago(4),
      customer_name: 'Karthik S.',
      customer_phone: '+9199••••7781',
      pickup_slot_label: '5:30 PM',
      items: [
        { name: 'Idli Rice', name_ta: 'இட்லி அரிசி', pack_size: '1kg', quantity: 1, unit_price: 62 },
        { name: 'Toor Dal', name_ta: 'துவரம் பருப்பு', pack_size: '1kg', quantity: 1, unit_price: 145 },
        { name: 'Sunflower Oil', name_ta: 'சூரியகாந்தி எண்ணெய்', pack_size: '1l', quantity: 1, unit_price: 155 },
      ],
      subtotal_amount: 362,
    },
    {
      id: 'o3',
      order_code: 'K8T3',
      shop_slug: 'MRGNKLKI',
      status: 'ACCEPTED',
      created_at: ago(9),
      pending_acceptance_at: ago(9),
      accepted_at: ago(7),
      customer_name: 'Divya M.',
      customer_phone: '+9198••••4402',
      pickup_slot_label: 'ASAP',
      items: [
        { name: 'Aachi Chicken Masala', name_ta: 'ஆச்சி சிக்கன் மசாலா', pack_size: '100g', quantity: 2, unit_price: 40 },
        { name: 'Sugar', name_ta: 'சர்க்கரை', pack_size: '1kg', quantity: 1, unit_price: 45 },
      ],
      subtotal_amount: 125,
    },
    {
      id: 'o4',
      order_code: 'R5W1',
      shop_slug: 'MRGNKLKI',
      status: 'READY_FOR_PICKUP',
      created_at: ago(18),
      pending_acceptance_at: ago(18),
      accepted_at: ago(16),
      ready_at: ago(6),
      customer_name: 'Suresh K.',
      customer_phone: '+9197••••1195',
      pickup_slot_label: 'ASAP',
      items: [{ name: 'Tata Salt', name_ta: 'டாடா உப்பு', pack_size: '1kg', quantity: 3, unit_price: 28 }],
      subtotal_amount: 84,
    },
    {
      id: 'o5',
      order_code: 'C3H6',
      shop_slug: 'MRGNKLKI',
      status: 'COLLECTED',
      created_at: ago(55),
      pending_acceptance_at: ago(55),
      accepted_at: ago(53),
      ready_at: ago(45),
      collected_at: ago(38),
      customer_name: 'Meena P.',
      customer_phone: '+9198••••9930',
      pickup_slot_label: 'ASAP',
      items: [
        { name: 'Bru Coffee', name_ta: 'புரு காபி', pack_size: '100g', quantity: 1, unit_price: 95 },
        { name: 'Aavin Milk', name_ta: 'ஆவின் பால்', pack_size: '500ml', quantity: 1, unit_price: 28 },
      ],
      subtotal_amount: 123,
    },
  ];
}
