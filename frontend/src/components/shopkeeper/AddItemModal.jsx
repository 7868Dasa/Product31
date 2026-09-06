import { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/index.jsx';
import { Modal } from '../Modal.jsx';
import { catalogKey } from '../../lib/csv.js';

const empty = {
  name: '',
  name_ta: '',
  brand: '',
  category: '',
  pack_size: '',
  price: '',
  stock_qty: '',
  barcode: '',
};

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl2 border-2 border-sand bg-white px-3 py-2.5 text-base outline-none focus:border-primary';

export function AddItemModal({ existing = [], onSave, onClose }) {
  const { t } = useI18n();
  const [f, setF] = useState(empty);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  // variant hint: same name already stocked in another pack size
  const variantSibling = useMemo(() => {
    const nm = f.name.trim().toLowerCase();
    if (!nm) return null;
    return existing.find(
      (x) => x.name.trim().toLowerCase() === nm && x.pack_size !== f.pack_size.trim(),
    );
  }, [f.name, f.pack_size, existing]);

  function submit(e) {
    e.preventDefault();
    const name = f.name.trim();
    const pack_size = f.pack_size.trim();
    const price = Number(f.price);
    const stock_qty = parseInt(f.stock_qty || '0', 10);
    if (!name) return setErr(t('add.needName'));
    if (!pack_size) return setErr(t('add.needPack'));
    if (!Number.isFinite(price) || price < 0) return setErr(t('add.needPrice'));

    const dup = existing.some((x) => catalogKey(x.name, x.pack_size) === catalogKey(name, pack_size));
    onSave({
      name,
      name_ta: f.name_ta.trim() || null,
      brand: f.brand.trim() || null,
      category: f.category.trim() || 'Uncategorised',
      pack_size,
      price,
      stock_qty: Number.isInteger(stock_qty) && stock_qty >= 0 ? stock_qty : 0,
      barcode: f.barcode.trim() || null,
      is_available: stock_qty > 0,
      variant_group: variantSibling?.variant_group || (variantSibling ? catalogKey(name, '') : undefined),
    });
    onClose(dup ? 'updated' : 'added');
  }

  return (
    <Modal
      title={t('add.title')}
      onClose={() => onClose(null)}
      footer={
        <div className="flex gap-2">
          <button
            onClick={() => onClose(null)}
            className="flex-1 rounded-full border-2 border-sand py-3 font-semibold text-ink-soft active:bg-sand"
          >
            {t('add.cancel')}
          </button>
          <button
            form="add-item-form"
            className="flex-[2] rounded-full bg-primary py-3 font-semibold text-white active:bg-primary-dark"
          >
            {t('add.save')}
          </button>
        </div>
      }
    >
      <form id="add-item-form" onSubmit={submit} className="space-y-3">
        <Field label={t('add.name')}>
          <input className={inputCls} value={f.name} onChange={set('name')} autoFocus required />
        </Field>
        <Field label={t('add.nameTa')}>
          <input className={inputCls} value={f.name_ta} onChange={set('name_ta')} lang="ta" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('add.brand')}>
            <input className={inputCls} value={f.brand} onChange={set('brand')} />
          </Field>
          <Field label={t('add.category')}>
            <input className={inputCls} value={f.category} onChange={set('category')} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('add.packSize')} hint={t('add.packSizeHint')}>
            <input className={inputCls} value={f.pack_size} onChange={set('pack_size')} required />
          </Field>
          <Field label={t('add.price')}>
            <input
              className={inputCls}
              type="number"
              min="0"
              inputMode="decimal"
              value={f.price}
              onChange={set('price')}
              required
            />
          </Field>
          <Field label={t('add.qty')}>
            <input
              className={inputCls}
              type="number"
              min="0"
              inputMode="numeric"
              value={f.stock_qty}
              onChange={set('stock_qty')}
            />
          </Field>
        </div>
        <Field label={t('add.barcode')}>
          <input className={inputCls} value={f.barcode} onChange={set('barcode')} inputMode="numeric" />
        </Field>

        {variantSibling && (
          <p className="rounded-xl2 bg-primary-tint px-3 py-2 text-sm text-primary-dark">
            {t('add.variantHint', { name: f.name.trim() })}
          </p>
        )}
        {err && <p className="text-sm font-semibold text-stop">⚠️ {err}</p>}
      </form>
    </Modal>
  );
}
