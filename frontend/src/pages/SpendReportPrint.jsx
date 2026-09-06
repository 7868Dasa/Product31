import { useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';

const fmtDate = (iso, lang) =>
  iso
    ? new Date(iso).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

/**
 * Printable spending report (the ₹29 deliverable). The page IS the document;
 * "Print / Save as PDF" uses the browser dialog — zero deps, same pattern as
 * the shop poster. Production serves a real pdfkit file from
 * GET /api/v1/users/me/spend-report.pdf (gated on the paid unlock).
 */
export function SpendReportPrint({ user }) {
  const { t, lang } = useI18n();
  const { spendReport, refreshMyOrders, reportUnlocked } = useStore();

  useEffect(() => {
    refreshMyOrders();
  }, [refreshMyOrders]);

  if (!reportUnlocked) return <Navigate to="/orders/report" replace />;
  const r = spendReport();

  return (
    <div className="min-h-screen bg-white text-ink">
      <style>{`@media print { .p31-noprint{display:none!important} @page{margin:14mm} body{background:#fff!important} }`}</style>

      <div className="p31-noprint sticky top-0 flex items-center justify-between border-b border-sand bg-cream px-4 py-3">
        <Link to="/orders/report" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft">
          <ArrowLeft size={16} /> {t('spend.title')}
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-white active:bg-primary-dark"
        >
          <Printer size={18} /> {t('poster.print')}
        </button>
      </div>

      <div className="mx-auto max-w-2xl px-8 py-8">
        <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
          <h1 className="text-2xl font-extrabold text-primary">{t('app.name')}</h1>
          <span className="text-sm text-ink-soft">{t('spend.pdfTitle')}</span>
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          {user?.phone_number ? `${t('account.phone')}: ${user.phone_number} · ` : ''}
          {t('spend.generated', { date: fmtDate(r.generated_at, lang) })}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <Box label={t('spend.totalSpent')} value={`₹${r.paid_total}`} />
          <Box label={t('orders.title')} value={r.order_count} />
          <Box label={t('spend.byShop')} value={r.shops_used} />
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          {t('spend.since', { date: fmtDate(r.first_order_at, lang) })} —{' '}
          {fmtDate(r.last_order_at, lang)}
        </p>

        <Section title={t('spend.byShop')}>
          {r.by_shop.map((s) => (
            <Row key={s.shop} left={`${s.shop} (${s.orders})`} right={`₹${s.spent}`} />
          ))}
        </Section>

        {r.by_month.length > 0 && (
          <Section title={t('spend.byMonth')}>
            {r.by_month.map((m) => (
              <Row key={m.month} left={m.month} right={`₹${m.spent}`} />
            ))}
          </Section>
        )}

        <Section title={t('spend.topItems')}>
          {r.top_items.map((it) => (
            <Row key={it.name} left={`${it.name} ×${it.times}`} right={`₹${it.spent}`} />
          ))}
        </Section>

        <Section title={t('orders.past')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink text-left text-xs uppercase text-ink-soft">
                <th className="py-1">{t('orders.code')}</th>
                <th className="py-1">{t('spend.byShop')}</th>
                <th className="py-1">Date</th>
                <th className="py-1 text-right">₹</th>
              </tr>
            </thead>
            <tbody>
              {r.orders.map((o) => (
                <tr key={o.order_code} className="border-b border-sand">
                  <td className="py-1 font-mono">{o.order_code}</td>
                  <td className="py-1">{o.shop}</td>
                  <td className="py-1">{fmtDate(o.date, lang)}</td>
                  <td className="py-1 text-right tabular-nums">₹{o.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <p className="mt-8 border-t border-sand pt-3 text-xs text-ink-soft">
          {t('poster.footer')} · {t('spend.pdfFootnote')}
        </p>
      </div>
    </div>
  );
}

const Box = ({ label, value }) => (
  <div className="rounded-xl2 border-2 border-sand p-3">
    <div className="text-xs text-ink-soft">{label}</div>
    <div className="text-xl font-extrabold">{value}</div>
  </div>
);
const Section = ({ title, children }) => (
  <section className="mt-6">
    <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-soft">{title}</h2>
    <div className="rounded-xl2 border-2 border-sand px-4 py-1">{children}</div>
  </section>
);
const Row = ({ left, right }) => (
  <div className="flex justify-between border-b border-sand py-2 text-sm last:border-0">
    <span>{left}</span>
    <span className="font-bold tabular-nums">{right}</span>
  </div>
);
