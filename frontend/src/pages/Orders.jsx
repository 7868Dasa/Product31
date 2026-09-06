import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Store, RotateCcw, Check, PieChart } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { ACTIVE } from '../lib/orderState.js';

const STEPS = ['placed', 'accepted', 'ready', 'collected'];
const STEP_OF = {
  PENDING_ACCEPTANCE: 0,
  ACCEPTED: 1,
  READY_FOR_PICKUP: 2,
  COLLECTED: 3,
};

function timeAgo(iso, t) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso)) / 1000));
  if (s < 3600) return t('time.min', { n: Math.floor(s / 60) || 1 });
  if (s < 86400) return t('time.hr', { n: Math.floor(s / 3600) });
  return t('time.day', { n: Math.floor(s / 86400) });
}

function StatusBar({ status, t }) {
  if (!ACTIVE.includes(status) && status !== 'COLLECTED') return null;
  const cur = STEP_OF[status] ?? 0;
  return (
    <ol className="mt-3 flex items-center gap-1">
      {STEPS.map((step, i) => (
        <li key={step} className="flex flex-1 items-center gap-1">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              i <= cur ? 'bg-primary text-white' : 'bg-sand text-ink-soft'
            }`}
          >
            {i < cur || (i === cur && status === 'COLLECTED') ? <Check size={13} /> : i + 1}
          </span>
          {i < STEPS.length - 1 && (
            <span className={`h-0.5 flex-1 ${i < cur ? 'bg-primary' : 'bg-sand'}`} />
          )}
        </li>
      ))}
    </ol>
  );
}

function OrderCard({ order, onBuyAgain }) {
  const { t, lang } = useI18n();
  const count = order.items.reduce((n, i) => n + (i.quantity < 1 ? 1 : Math.round(i.quantity)), 0);
  const summary = order.items
    .map((i) => (lang === 'ta' && i.name_ta ? i.name_ta : i.name))
    .slice(0, 3)
    .join(', ');
  const done = !ACTIVE.includes(order.status);

  return (
    <article className="rounded-xl2 border-2 border-sand bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/s/${order.shop_slug}`}
            className="flex items-center gap-1.5 font-bold text-ink"
          >
            <Store size={15} className="text-primary" /> {order.shop_name || order.shop_slug}
          </Link>
          <div className="mt-0.5 text-xs text-ink-soft">
            {timeAgo(order.created_at, t)} · {t('orders.code')} {order.order_code}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            order.status === 'COLLECTED'
              ? 'bg-go/15 text-go'
              : order.status === 'READY_FOR_PICKUP'
                ? 'bg-primary text-white'
                : ACTIVE.includes(order.status)
                  ? 'bg-primary-tint text-primary-dark'
                  : 'bg-stop/15 text-stop'
          }`}
        >
          {t(`ord.status.${order.status}`)}
        </span>
      </div>

      <p className="mt-2 truncate text-sm text-ink-soft">
        {t('orders.items', { n: count })} · {summary}
      </p>
      <p className="text-base font-bold">
        {order.price_pending || order.subtotal_amount == null
          ? t('shop.priceAtCounter')
          : `${t('sk.total')} ₹${order.subtotal_amount}`}
      </p>
      {order.status === 'REJECTED' && order.rejection_reason && (
        <p className="mt-1 text-sm text-stop">
          {t('ord.rejectedReason', { reason: order.rejection_reason })}
        </p>
      )}

      <StatusBar status={order.status} t={t} />

      {done && (
        <button
          onClick={() => onBuyAgain(order)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-primary px-4 py-2 text-sm font-bold text-primary active:bg-primary-tint"
        >
          <RotateCcw size={15} /> {t('orders.buyAgain')}
        </button>
      )}
    </article>
  );
}

/** Fetch on mount + on tab focus; poll every 20s while an order is active. */
function useLiveOrders(refreshMyOrders, orders) {
  const hasActive = useMemo(() => orders.some((o) => ACTIVE.includes(o.status)), [orders]);
  const activeRef = useRef(hasActive);
  activeRef.current = hasActive;

  useEffect(() => {
    refreshMyOrders();
    const onFocus = () => {
      if (!document.hidden) refreshMyOrders();
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    const id = setInterval(() => {
      if (activeRef.current && !document.hidden) refreshMyOrders();
    }, 20_000);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      clearInterval(id);
    };
  }, [refreshMyOrders]);
}

export function Orders({ user }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { myOrders, refreshMyOrders, buyAgain } = useStore();
  const [loaded, setLoaded] = useState(false);
  const all = myOrders();

  useLiveOrders(refreshMyOrders, all);
  useEffect(() => {
    refreshMyOrders().finally(() => setLoaded(true));
  }, [refreshMyOrders]);

  const { active, past } = useMemo(
    () => ({
      active: all.filter((o) => ACTIVE.includes(o.status)),
      past: all.filter((o) => !ACTIVE.includes(o.status)),
    }),
    [all],
  );

  function onBuyAgain(order) {
    const slug = buyAgain(order);
    navigate(`/s/${slug}`);
  }

  return (
    <div className="min-h-screen pb-24">
      <TopBar user={user} />
      <main className="mx-auto max-w-md space-y-6 px-4 py-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('orders.title')}</h1>
          {all.length > 0 && (
            <Link
              to="/orders/report"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary px-3 py-1.5 text-sm font-bold text-primary active:bg-primary-tint"
            >
              <PieChart size={15} /> {t('spend.title')}
            </Link>
          )}
        </div>

        {loaded && all.length === 0 && (
          <p className="rounded-xl2 border-2 border-dashed border-sand px-4 py-10 text-center text-ink-soft">
            {t('orders.empty')}
          </p>
        )}

        {active.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              {t('orders.active')}
            </h2>
            {active.map((o) => (
              <OrderCard key={o.id} order={o} onBuyAgain={onBuyAgain} />
            ))}
          </section>
        )}

        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
              {t('orders.past')}
            </h2>
            {past.map((o) => (
              <OrderCard key={o.id} order={o} onBuyAgain={onBuyAgain} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
