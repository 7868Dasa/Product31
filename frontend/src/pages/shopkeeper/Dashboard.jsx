import { useState, useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Store, Bell, ChefHat, Boxes, QrCode, IndianRupee, ArrowLeftRight, Printer } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { useStore } from '../../store.jsx';
import { LangToggle } from '../../components/LangToggle.jsx';
import { OrderCard } from '../../components/shopkeeper/OrderCard.jsx';
import { CatalogManager } from '../../components/shopkeeper/CatalogManager.jsx';
import { QrImage } from '../../components/QrImage.jsx';
import { shopShareUrl } from '../../lib/qr.js';

const TABS = [
  { key: 'new', icon: Bell },
  { key: 'active', icon: ChefHat },
  { key: 'stock', icon: Boxes },
  { key: 'qr', icon: QrCode },
  { key: 'history', icon: IndianRupee },
];

export function Dashboard() {
  const { t } = useI18n();
  const {
    myShop,
    ordersForShop,
    isShopOpen,
    toggleShopOpen,
    acceptOrder,
    rejectOrder,
    markReady,
    markCollected,
  } = useStore();
  const [tab, setTab] = useState('new');

  const orders = myShop ? ordersForShop(myShop.slug) : [];
  const groups = useMemo(
    () => ({
      new: orders.filter((o) => o.status === 'PENDING_ACCEPTANCE'),
      active: orders.filter((o) => ['ACCEPTED', 'READY_FOR_PICKUP'].includes(o.status)),
      history: orders.filter((o) => o.status === 'COLLECTED'),
    }),
    [orders],
  );

  // No shop yet → go set one up (spec §5). (after hooks, per rules-of-hooks)
  if (!myShop) return <Navigate to="/shop/onboarding" replace />;

  const shop = myShop;
  const open = isShopOpen(shop.slug);
  const cashToday = groups.history.reduce((s, o) => s + o.subtotal_amount, 0);
  const actions = { onAccept: acceptOrder, onReject: rejectOrder, onReady: markReady, onCollected: markCollected };

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-sand bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Store size={20} className="shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold leading-tight">{shop.shop_name}</div>
              <div className="text-xs text-ink-soft">{t('sk.title')}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LangToggle />
            <Link
              to="/"
              aria-label={t('back.toRoles')}
              className="inline-flex items-center rounded-full border-2 border-sand bg-white p-2.5 text-ink-soft active:bg-sand"
            >
              <ArrowLeftRight size={16} />
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 pb-3">
          <button
            onClick={() => toggleShopOpen(shop.slug)}
            className={`flex w-full items-center justify-center gap-3 rounded-full px-5 py-3 text-lg font-bold text-white transition-colors ${
              open ? 'bg-go' : 'bg-stop'
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white/90" aria-hidden="true" />
            {open ? t('sk.openNow') : t('sk.closedNow')}
            <span className="text-sm font-medium opacity-80">
              · {open ? t('sk.tapToClose') : t('sk.tapToOpen')}
            </span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4">
        <nav className="mt-4 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {TABS.map(({ key, icon: Icon }) => {
            const badge = key === 'new' ? groups.new.length : 0;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-4 py-2.5 text-sm font-bold ${
                  tab === key
                    ? 'border-primary bg-primary text-white'
                    : 'border-sand bg-white text-ink-soft'
                }`}
              >
                <Icon size={17} />
                {t(`sk.tab.${key}`)}
                {badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-xs ${
                      tab === key ? 'bg-white/25' : 'bg-primary text-white'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-4 space-y-3">
          {tab === 'new' &&
            (groups.new.length === 0 ? (
              <Empty text={t('sk.new.none')} />
            ) : (
              groups.new.map((o) => (
                <OrderCard key={o.id} order={o} slaMinutes={shop.acceptance_sla_minutes} {...actions} />
              ))
            ))}

          {tab === 'active' &&
            (groups.active.length === 0 ? (
              <Empty text={t('sk.active.none')} />
            ) : (
              groups.active.map((o) => <OrderCard key={o.id} order={o} {...actions} />)
            ))}

          {tab === 'history' && (
            <>
              <div className="rounded-xl2 border-2 border-sand bg-white p-5 text-center">
                <div className="text-sm font-semibold text-ink-soft">{t('sk.history.cash')}</div>
                <div className="text-4xl font-extrabold text-go">₹{cashToday}</div>
                <div className="text-sm text-ink-soft">
                  {t('sk.history.orders', { n: groups.history.length })}
                </div>
              </div>
              {groups.history.length === 0 ? (
                <Empty text={t('sk.history.none')} />
              ) : (
                groups.history.map((o) => <OrderCard key={o.id} order={o} {...actions} />)
              )}
            </>
          )}

          {tab === 'stock' && <CatalogManager slug={shop.slug} />}

          {tab === 'qr' && <QrPanel shop={shop} t={t} />}
        </div>
      </div>
    </div>
  );
}

function QrPanel({ shop, t }) {
  const url = shopShareUrl(shop.slug);
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl2 border-2 border-sand bg-white p-6 text-center">
      <h3 className="text-lg font-bold">{t('qr.title')}</h3>
      <p className="text-sm text-ink-soft">{t('qr.sub')}</p>
      <QrImage
        text={url}
        size={512}
        alt="Shop QR code"
        className="h-52 w-52 rounded-xl2 border-2 border-sand p-2"
      />
      <code className="break-all rounded-lg bg-sand px-3 py-1.5 text-xs">{url}</code>
      <Link
        to={`/p/${shop.slug}`}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-white active:bg-primary-dark"
      >
        <Printer size={18} /> {t('qr.openPoster')}
      </Link>
      <p className="text-xs text-ink-soft">{t('qr.reprintNote')}</p>
    </div>
  );
}

function Empty({ text }) {
  return (
    <p className="rounded-xl2 border-2 border-dashed border-sand px-4 py-10 text-center text-base text-ink-soft">
      {text}
    </p>
  );
}
