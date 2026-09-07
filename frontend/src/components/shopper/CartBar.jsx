import { useState } from 'react';
import { ShoppingCart, Minus, Plus, Trash2, Check } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { useStore } from '../../store.jsx';
import { Modal } from '../Modal.jsx';

function qtyLabel(l) {
  if (l.sell_by === 'weight') {
    const u = l.unit || 'kg';
    if (u === 'kg') return l.qty < 1 ? `${Math.round(l.qty * 1000)} g` : `${Number(l.qty.toFixed(2))} kg`;
    if (u === 'l') return l.qty < 1 ? `${Math.round(l.qty * 1000)} ml` : `${Number(l.qty.toFixed(2))} l`;
  }
  return `${l.qty}`;
}
const priceLabel = (l, t) => {
  if (!l.unit_price) return t('shop.priceAtCounter');
  return l.sell_by === 'weight' ? `₹${l.unit_price}/${l.unit || 'kg'}` : `₹${l.unit_price}`;
};
const lineTotal = (l) => Math.round((l.unit_price || 0) * l.qty);

export function CartBar({ shop }) {
  const { t, lang } = useI18n();
  const { cartForShop, setCartQty, clearCart, placeOrder } = useStore();
  const lines = cartForShop(shop.slug);
  const [open, setOpen] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const order = await placeOrder(shop.slug);
      setPlaced(order);
      setOpen(false);
    } catch (e) {
      setErr(e && e.message ? e.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  const total = lines.reduce((s, l) => s + lineTotal(l), 0);
  if (lines.length === 0 && !placed) return null;

  const nameOf = (l) => (lang === 'ta' && l.name_ta ? l.name_ta : l.name);
  const stepOf = (l) => (l.sell_by === 'weight' ? l.step_qty || 0.25 : 1);

  return (
    <>
      <div className="fixed inset-x-0 bottom-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))] z-40 animate-fade-up px-4">
        <button
          onClick={() => setOpen(true)}
          className="mx-auto flex w-full max-w-md items-center justify-between rounded-full bg-primary px-5 py-3.5 text-white shadow-[0_12px_30px_-6px_rgba(124,58,237,0.55)] transition-transform active:scale-[0.98] active:bg-primary-dark"
        >
          <span className="flex items-center gap-2 font-bold">
            <ShoppingCart size={20} /> {t('cart.count', { n: lines.length })}
          </span>
          <span className="font-bold">
            {total > 0 ? `₹${total}` : t('cart.atCounter')} · {t('cart.review')}
          </span>
        </button>
      </div>

      {open && (
        <Modal
          title={t('cart.title')}
          onClose={() => setOpen(false)}
          footer={
            <button
              onClick={submit}
              disabled={lines.length === 0 || busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-lg font-semibold text-white active:bg-primary-dark disabled:opacity-50"
            >
              {busy ? t('cart.placing') : t('cart.place')}
            </button>
          }
        >
          {err && (
            <p className="mb-2 rounded-xl bg-stop/10 px-3 py-2 text-sm font-semibold text-stop">{err}</p>
          )}
          <ul className="divide-y divide-sand/70">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold tracking-tight">
                    {nameOf(l)}{' '}
                    {l.pack_size && <span className="text-sm text-ink-soft">{l.pack_size}</span>}
                  </div>
                  <div className="text-sm text-ink-soft">
                    {priceLabel(l, t)}
                    {l.unit_price > 0 && <> · ₹{lineTotal(l)}</>}
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-sand bg-sand-soft py-1 pl-1.5 pr-2">
                  <button
                    onClick={() => setCartQty(shop.slug, l.id, l.qty - stepOf(l))}
                    className="rounded-full bg-white p-1.5 shadow-card transition-transform active:scale-90"
                    aria-label="−"
                  >
                    <Minus size={15} />
                  </button>
                  <span className="min-w-[3.5rem] text-center font-bold tabular-nums">{qtyLabel(l)}</span>
                  <button
                    onClick={() => setCartQty(shop.slug, l.id, Math.min(l.qty + stepOf(l), l.max_qty || Infinity))}
                    className="rounded-full bg-primary p-1.5 text-white shadow-card transition-transform active:scale-90"
                    aria-label="+"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => clearCart(shop.slug)}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-stop"
          >
            <Trash2 size={14} /> {t('cart.clear')}
          </button>
          <p className="mt-3 text-xs text-ink-soft">{t('cart.codNote')}</p>
        </Modal>
      )}

      {placed && (
        <Modal title={t('cart.placedTitle')} onClose={() => setPlaced(null)}>
          <div className="flex flex-col items-center gap-4 py-3 text-center">
            <span className="flex h-16 w-16 animate-pop-in items-center justify-center rounded-full bg-go/15 text-go">
              <Check size={32} strokeWidth={2.5} />
            </span>
            <p className="text-base font-medium text-ink-soft">{t('cart.placedSub')}</p>
            <div className="w-full rounded-2xl bg-primary-wash px-4 py-5">
              <div className="font-mono text-4xl font-extrabold tracking-[0.22em] text-primary-dark">
                {placed.order_code}
              </div>
            </div>
            <p className="text-sm text-ink-soft">{t('cart.placedHint')}</p>
          </div>
        </Modal>
      )}
    </>
  );
}
