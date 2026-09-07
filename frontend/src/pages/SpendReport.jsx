import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, FileDown, Lock, Check, Store } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { REPORT_PRICE_INR } from '../lib/spend.js';

const monthLabel = (m, lang) =>
  new Date(`${m}-01`).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
    month: 'short',
    year: 'numeric',
  });
const dateLabel = (iso, lang) =>
  iso ? new Date(iso).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function SpendReport({ user }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { spendReport, refreshMyOrders, reportUnlocked, unlockSpendReport } = useStore();
  const r = spendReport();
  const [paid, setPaid] = useState(null);

  useEffect(() => {
    refreshMyOrders();
  }, [refreshMyOrders]);

  return (
    <div className="min-h-dvh pb-24">
      <TopBar user={user} />
      <main className="mx-auto max-w-md space-y-5 px-4 py-5">
        <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft">
          <ChevronLeft size={16} /> {t('nav.orders')}
        </Link>
        <h1 className="text-2xl font-bold">{t('spend.title')}</h1>

        {r.order_count === 0 ? (
          <p className="rounded-xl2 border-2 border-dashed border-sand px-4 py-10 text-center text-ink-soft">
            {t('spend.empty')}
          </p>
        ) : (
          <>
            <div className="rounded-xl2 border border-sand shadow-card bg-white p-5 text-center">
              <div className="text-sm font-semibold text-ink-soft">{t('spend.totalSpent')}</div>
              <div className="text-4xl font-extrabold text-primary">₹{r.paid_total}</div>
              <div className="mt-1 text-sm text-ink-soft">
                {t('spend.acrossOrders', { n: r.order_count, shops: r.shops_used })}
              </div>
              <div className="text-xs text-ink-soft">
                {t('spend.since', { date: dateLabel(r.first_order_at, lang) })}
                {r.pending_total > 0 && ` · ${t('spend.pending', { amt: r.pending_total })}`}
              </div>
            </div>

            {r.by_shop.length > 0 && (
              <section>
                <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
                  {t('spend.byShop')}
                </h2>
                <ul className="divide-y divide-sand rounded-xl2 border border-sand shadow-card bg-white px-4">
                  {r.by_shop.map((s) => (
                    <li key={s.shop} className="flex items-center justify-between py-3 text-sm">
                      <span className="flex items-center gap-1.5">
                        <Store size={14} className="text-primary" /> {s.shop}
                        <span className="text-ink-soft"> · {t('orders.items', { n: s.orders })}</span>
                      </span>
                      <span className="font-bold tabular-nums">₹{s.spent}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {r.by_month.length > 1 && (
              <section>
                <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
                  {t('spend.byMonth')}
                </h2>
                <ul className="divide-y divide-sand rounded-xl2 border border-sand shadow-card bg-white px-4">
                  {r.by_month.map((m) => (
                    <li key={m.month} className="flex justify-between py-2.5 text-sm">
                      <span>{monthLabel(m.month, lang)}</span>
                      <span className="font-bold tabular-nums">₹{m.spent}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {r.top_items.length > 0 && (
              <section>
                <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
                  {t('spend.topItems')}
                </h2>
                <ul className="divide-y divide-sand rounded-xl2 border border-sand shadow-card bg-white px-4">
                  {r.top_items.map((it) => (
                    <li key={it.name} className="flex justify-between py-2.5 text-sm">
                      <span>
                        {lang === 'ta' && it.name_ta ? it.name_ta : it.name}
                        <span className="text-ink-soft"> ×{it.times}</span>
                      </span>
                      <span className="font-bold tabular-nums">₹{it.spent}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── paid PDF ─────────────────────────────────────────────── */}
            <section className="rounded-xl2 border-2 border-primary/30 bg-primary-tint/40 p-4">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <FileDown size={18} className="text-primary" /> {t('spend.pdfTitle')}
              </h2>
              <p className="mt-1 text-sm text-ink-soft">{t('spend.pdfDesc')}</p>

              {reportUnlocked || paid ? (
                <button
                  onClick={() => navigate('/orders/report/print')}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-white active:bg-primary-dark"
                >
                  <FileDown size={18} /> {t('spend.download')}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setPaid(unlockSpendReport())}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-white active:bg-primary-dark"
                  >
                    <Lock size={16} /> {t('spend.unlock', { price: REPORT_PRICE_INR })}
                  </button>
                  <p className="mt-2 text-xs text-ink-soft">{t('spend.payNote')}</p>
                </>
              )}
              {paid && (
                <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-go">
                  <Check size={15} /> {t('spend.paidDemo', { price: REPORT_PRICE_INR })}
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
