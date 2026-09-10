import { useState, useEffect } from 'react';
import { Clock, Check, X, PackageCheck, IndianRupee, Printer } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { printOrderTicket } from '../../lib/printTicket.js';

function useNow(active) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

export function OrderCard({ order, slaMinutes = 5, onAccept, onReject, onReady, onCollected }) {
  const { t, lang } = useI18n();
  const isPending = order.status === 'PENDING_ACCEPTANCE';
  useNow(isPending);

  const deadline = new Date(order.created_at).getTime() + slaMinutes * 60_000;
  const remainingMs = deadline - Date.now();
  const overdue = remainingMs <= 0;
  const mm = Math.max(0, Math.floor(remainingMs / 60_000));
  const ss = Math.max(0, Math.floor((remainingMs % 60_000) / 1000));

  const count = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <article className="card animate-fade-up p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">
            {t('sk.order')}
          </div>
          <div className="font-mono text-3xl font-extrabold tracking-[0.14em] text-primary">
            {order.order_code}
          </div>
        </div>
        {isPending ? (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold ${
              overdue ? 'bg-stop/15 text-stop' : 'bg-warn/15 text-warn'
            }`}
          >
            <Clock size={15} />
            {overdue
              ? t('sk.slaOver')
              : t('sk.slaLeft', { m: mm, s: String(ss).padStart(2, '0') })}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-primary-tint px-3 py-1 text-sm font-extrabold uppercase tracking-wide text-primary-dark">
            {t(`sk.status.${order.status}`)}
          </span>
        )}
      </div>

      <ul className="mt-3 space-y-1">
        {order.items.map((it, i) => (
          <li key={i} className="flex justify-between text-base">
            <span>
              <span className="font-semibold">{it.quantity}×</span>{' '}
              {lang === 'ta' && it.name_ta ? it.name_ta : it.name}{' '}
              <span className="text-ink-soft">{it.pack_size}</span>
            </span>
            <span className="tabular-nums text-ink-soft">
              ₹{it.line_total || Math.round((it.unit_price || 0) * it.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-sand/70 pt-3 text-sm">
        <span className="text-ink-soft">
          {t('sk.customer')}: <span className="font-semibold text-ink">{order.customer_name}</span>
          {(order.customer_phone_masked || order.customer_phone) && (
            <> · {order.customer_phone_masked || order.customer_phone}</>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between text-base font-bold">
        <span>
          {t('sk.pickup')}:{' '}
          {!order.pickup_slot_label || order.pickup_slot_label === 'ASAP'
            ? t('pickup.asap')
            : order.pickup_slot_label}
        </span>
        <span>
          {t('sk.total')} ₹{order.subtotal_amount}
        </span>
      </div>

      <button
        onClick={() => printOrderTicket(order, t, lang)}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft active:text-primary"
      >
        <Printer size={15} /> {t('sk.printTicket')}
      </button>

      <div className="mt-4 flex gap-2">
        {order.status === 'PENDING_ACCEPTANCE' && (
          <>
            <button
              onClick={() => onReject(order.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-stop/40 py-3 font-semibold text-stop transition-transform active:scale-[0.97] active:bg-stop/10"
            >
              <X size={18} /> {t('sk.reject')}
            </button>
            <button
              onClick={() => onAccept(order.id)}
              className="flex flex-[2] items-center justify-center gap-1.5 rounded-full bg-primary py-3 font-semibold text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.5)] transition-transform active:scale-[0.97] active:bg-primary-dark"
            >
              <Check size={18} /> {t('sk.accept')}
            </button>
          </>
        )}
        {order.status === 'ACCEPTED' && (
          <button
            onClick={() => onReady(order.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary py-3 font-semibold text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.5)] transition-transform active:scale-[0.98] active:bg-primary-dark"
          >
            <PackageCheck size={18} /> {t('sk.markReady')}
          </button>
        )}
        {order.status === 'READY_FOR_PICKUP' && (
          <button
            onClick={() => onCollected(order.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-go py-3 font-semibold text-white shadow-[0_6px_16px_-4px_rgba(21,128,61,0.45)] transition-transform active:scale-[0.98] active:opacity-90"
          >
            <IndianRupee size={18} /> {t('sk.markCollected')}
          </button>
        )}
      </div>
    </article>
  );
}
