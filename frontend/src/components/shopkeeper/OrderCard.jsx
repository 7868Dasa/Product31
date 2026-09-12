import { useState, useEffect } from 'react';
import { Clock, Check, X, PackageCheck, IndianRupee, Printer, PackageX } from 'lucide-react';
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

export function OrderCard({
  order,
  slaMinutes = 5,
  onAccept,
  onReject,
  onReady,
  onCollected,
  onFlagUnavailable,
}) {
  const { t, lang } = useI18n();
  const isPending = order.status === 'PENDING_ACCEPTANCE';
  useNow(isPending);

  const [flagging, setFlagging] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  function togglePick(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function submitFlags() {
    if (!picked.size) return;
    onFlagUnavailable(order.id, [...picked]);
    setFlagging(false);
    setPicked(new Set());
  }

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

      {flagging && <p className="mt-3 text-sm font-semibold text-ink-soft">{t('sk.flagHint')}</p>}

      <ul className="mt-3 space-y-1">
        {order.items.map((it, i) => (
          <li key={it.id ?? i}>
            <label
              className={`flex items-center justify-between gap-2 text-base ${
                flagging ? 'cursor-pointer' : ''
              } ${it.unavailable ? 'opacity-50' : ''}`}
            >
              <span className="flex items-center gap-2">
                {flagging && (
                  <input
                    type="checkbox"
                    checked={picked.has(it.id)}
                    onChange={() => togglePick(it.id)}
                    className="h-4 w-4 shrink-0 accent-stop"
                  />
                )}
                <span className={it.unavailable ? 'line-through' : ''}>
                  <span className="font-semibold">{it.quantity}×</span>{' '}
                  {lang === 'ta' && it.name_ta ? it.name_ta : it.name}{' '}
                  <span className="text-ink-soft">{it.pack_size}</span>
                </span>
                {it.unavailable && (
                  <span className="rounded-full bg-stop/15 px-2 py-0.5 text-xs font-bold text-stop">
                    {t('sk.itemUnavailable')}
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-ink-soft">
                ₹{it.line_total || Math.round((it.unit_price || 0) * it.quantity)}
              </span>
            </label>
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
          {order.status === 'PENDING_CONFIRMATION' && order.revised_subtotal != null
            ? `${t('sk.revisedTotal')} ₹${order.revised_subtotal}`
            : `${t('sk.total')} ₹${order.subtotal_amount}`}
        </span>
      </div>

      {order.status === 'PENDING_CONFIRMATION' && (
        <p className="mt-2 rounded-xl bg-warn/15 px-3 py-2 text-sm font-semibold text-warn">
          {t('sk.waitingConfirm')}
        </p>
      )}

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
        {order.status === 'ACCEPTED' && !flagging && (
          <>
            <button
              onClick={() => setFlagging(true)}
              className="flex items-center justify-center gap-1.5 rounded-full border border-sand px-4 py-3 font-semibold text-ink-soft transition-transform active:scale-[0.97] active:bg-sand-soft"
            >
              <PackageX size={18} />
            </button>
            <button
              onClick={() => onReady(order.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-3 font-semibold text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.5)] transition-transform active:scale-[0.98] active:bg-primary-dark"
            >
              <PackageCheck size={18} /> {t('sk.markReady')}
            </button>
          </>
        )}
        {order.status === 'ACCEPTED' && flagging && (
          <>
            <button
              onClick={() => {
                setFlagging(false);
                setPicked(new Set());
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-sand py-3 font-semibold text-ink-soft transition-transform active:scale-[0.97] active:bg-sand-soft"
            >
              {t('sk.flagCancel')}
            </button>
            <button
              onClick={submitFlags}
              disabled={!picked.size}
              className="flex flex-[2] items-center justify-center gap-1.5 rounded-full bg-stop py-3 font-semibold text-white shadow-[0_6px_16px_-4px_rgba(220,38,38,0.45)] transition-transform active:scale-[0.97] disabled:opacity-40"
            >
              <PackageX size={18} /> {t('sk.flagSelected', { n: picked.size })}
            </button>
          </>
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
