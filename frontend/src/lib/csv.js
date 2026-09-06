/**
 * CSV helpers for the shopkeeper catalog manager (spec §5 "bulk Excel/CSV
 * upload", plus the new-prompt preview-modal + sample-template flow).
 * Parsing runs client-side via papaparse. The real server-side import lands
 * with build step 9.
 */
import Papa from 'papaparse';

export const CSV_COLUMNS = [
  'name',
  'name_ta',
  'brand',
  'category',
  'unit',
  'pack_size',
  'price',
  'stock_qty',
  'barcode',
];

/** A ready-to-fill template with a few Tamil-Nadu grocery rows. */
export function buildSampleCsv() {
  const data = [
    ['Aachi Chicken Masala', 'ஆச்சி சிக்கன் மசாலா', 'Aachi', 'Masala & Spices', 'g', '50g', '22', '40', ''],
    ['Aachi Chicken Masala', 'ஆச்சி சிக்கன் மசாலா', 'Aachi', 'Masala & Spices', 'g', '100g', '40', '25', ''],
    ['Aavin Milk', 'ஆவின் பால்', 'Aavin', 'Dairy', 'ml', '500ml', '28', '30', '8901234567890'],
    ['Idli Rice', 'இட்லி அரிசி', '', 'Rice & Grains', 'kg', '1kg', '62', '50', ''],
    ['Toor Dal', 'துவரம் பருப்பு', '', 'Pulses', 'kg', '1kg', '145', '18', ''],
  ];
  return Papa.unparse({ fields: CSV_COLUMNS, data }, { newline: '\n' });
}

/** Trigger a browser download of a text file (this is the shop's own dev app). */
export function downloadTextFile(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime }); // BOM so Excel reads UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const num = (v) => {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Parse catalog CSV text into { valid, invalid, parseErrors }.
 * `valid` rows are normalised and ready to merge into the catalog.
 * `invalid` rows carry a human reason and the source line number.
 */
export function parseCatalogCsv(text) {
  const normalised = String(text)
    .replace(/^﻿/, '') // strip BOM
    .replace(/\r\n?/g, '\n') // normalise line endings
    .trim();

  const { data, errors } = Papa.parse(normalised, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  const valid = [];
  const invalid = [];

  data.forEach((raw, i) => {
    const line = i + 2; // +1 header, +1 to 1-index
    const row = {
      name: (raw.name || '').trim(),
      name_ta: (raw.name_ta || '').trim() || null,
      brand: (raw.brand || '').trim() || null,
      category: (raw.category || '').trim() || 'Uncategorised',
      unit: (raw.unit || '').trim() || null,
      pack_size: (raw.pack_size || '').trim() || null,
      price: num(raw.price),
      stock_qty: num(raw.stock_qty),
      barcode: (raw.barcode || '').trim() || null,
    };

    const problems = [];
    if (!row.name) problems.push('missing name');
    if (!row.pack_size) problems.push('missing pack_size');
    if (!Number.isFinite(row.price) || row.price < 0) problems.push('bad price');
    if (!Number.isInteger(row.stock_qty) || row.stock_qty < 0) problems.push('bad stock_qty');

    if (problems.length) {
      invalid.push({ line, name: row.name || '(no name)', reason: problems.join(', ') });
    } else {
      valid.push({ ...row, is_available: row.stock_qty > 0 });
    }
  });

  return { valid, invalid, parseErrors: errors };
}

/** Match key for upsert (name + pack size, case-insensitive). */
export const catalogKey = (name, packSize) =>
  `${String(name).trim().toLowerCase()}|${String(packSize ?? '').trim().toLowerCase()}`;
