import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Store, Bell, BellOff, ChefHat, Boxes, QrCode, IndianRupee, ArrowLeftRight, Printer } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { useStore } from '../../store.jsx';
import { LangToggle } from '../../components/LangToggle.jsx';
import { OrderCard } from '../../components/shopkeeper/OrderCard.jsx';
import { CatalogManager } from '../../components/shopkeeper/CatalogManager.jsx';
import { QrImage } from '../../components/QrImage.jsx';
import { shopShareUrl } from '../../lib/qr.js';
import {
  beep,
  notify,
  setTitleBadge,
  askNotificationPermission,
  notificationsGranted,
  notificationsSupported,
} from '../../lib/orderAlert.js';

/** Blip + desktop notification + tab badge when a new PENDING order appears. */
function useNewOrderAlert(pending, t) {
  const seen = useRef(null); // null until first load, then a Set of ids
  useEffect(() => {
    const ids = new Set(pending.map((o) => o.id));
    if (seen.current === null) {
      seen.current = ids; // first render — don't alert on the initial backlog
      setTitleBadge(pending.length);
      return;
    }
    const fresh = pending.filter((o) => !seen.current.has(o.id));
    if (fresh.length) {
      beep();
      const o = fresh[0];
      const n = o.items.reduce((s, i) => s + (i.quantity < 1 ? 1 : Math.round(i.quantity)), 0);
      notify(
        t('sk.alert.title', { code: o.order_code }),
        fresh.length > 1 ? t('sk.alert.many', { n: fresh.length }) : t('sk.alert.body', { n }),
      );
    }
    seen.current = ids;
    setTitleBadge(pending.length);
  }, [pending, t]);

  useEffect(() => () => setTitleBadge(0), []);
}

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
    refreshQueue,
    refreshMyShop,
    isShopOpen,
    toggleShopOpen,
    acceptOrder,
    rejectOrder,
    markReady,
    markCollected,
  } = useStore();
  const [tab, setTab] = useState('new');

  const slug = myShop ? myShop.slug : null;
  const orders = slug ? ordersForShop(slug) : [];

  // Live queue: fetch on mount + focus, poll every 15s while the shop is open.
  const openRef = useRef(false);
  openRef.current = slug ? isShopOpen(slug) : false;
  useEffect(() => {
    if (!slug) return undefined;
    refreshMyShop();
    refreshQueue(slug);
    const onFocus = () => {
      if (!document.hidden) refreshQueue(slug);
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    const id = setInterval(() => {
      if (openRef.current && !document.hidden) refreshQueue(slug);
    }, 15_000);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      clearInterval(id);
    };
  }, [slug, refreshQueue]);
  const groups = useMemo(
    () => ({
      new: orders.filter((o) => o.status === 'PENDING_ACCEPTANCE'),
      active: orders.filter((o) => ['ACCEPTED', 'READY_FOR_PICKUP'].includes(o.status)),
      history: orders.filter((o) => o.status === 'COLLECTED'),
    }),
    [orders],
  );

  useNewOrderAlert(groups.new, t);
  const [alertsOn, setAlertsOn] = useState(() => notificationsGranted());
  async function enableAlerts() {
    beep(); // also unlocks WebAudio for later blips
    const res = await askNotificationPermission();
    setAlertsOn(res === 'granted');
  }

  // No shop yet → go set one up (spec §5). (after hooks, per rules-of-hooks)
  if (!myShop) return <Navigate to="/shop/onboarding" replace />;

  const shop = myShop;
  const open = isShopOpen(shop.slug);
  const cashToday = groups.history.reduce((s, o) => s + (o.subtotal_amount || 0), 0);
  // On a 409 (order changed under us) just refetch the queue so the card catches up.
  const onErr = (e) => {
    if (e && e.status === 409) refreshQueue(shop.slug);
  };
  const actions = {
    onAccept: (id) => acceptOrder(id).catch(onErr),
    onReject: (id) => rejectOrder(id).catch(onErr),
    onReady: (id) => markReady(id).catch(onErr),
    onCollected: (id) => markCollected(id).catch(onErr),
  };

  return (
    <div className="min-h-dvh pb-nav">
      <header className="frost pt-safe sticky top-0 z-30 border-b border-sand/60">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="chip-icon h-9 w-9 shrink-0 text-primary">
              <Store size={18} strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold leading-tight tracking-tight">
                {shop.shop_name}
              </div>
              <div className="text-xs text-ink-faint">{t('sk.title')}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {notificationsSupported() && (
              <button
                onClick={enableAlerts}
                aria-label={t('sk.alert.toggle')}
                title={alertsOn ? t('sk.alert.on') : t('sk.alert.off')}
                className={`inline-flex items-center rounded-full border p-2.5 shadow-card transition-transform active:scale-90 ${
                  alertsOn
                    ? 'border-primary bg-primary-tint text-primary-dark'
                    : 'border-sand bg-white text-ink-soft'
                }`}
              >
                {alertsOn ? <Bell size={16} /> : <BellOff size={16} />}
              </button>
            )}
            <LangToggle />
            <Link
              to="/"
              aria-label={t('back.toRoles')}
              className="inline-flex items-center rounded-full border border-sand bg-white p-2.5 text-ink-soft shadow-card transition-transform active:scale-90"
            >
              <ArrowLeftRight size={16} />
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 pb-3">
          <button
            onClick={() => toggleShopOpen(shop.slug)}
            className={`flex w-full items-center justify-center gap-3 rounded-full px-5 py-3 text-lg font-bold text-white shadow-raise transition-transform active:scale-[0.99] ${
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
        <nav className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ key, icon: Icon }) => {
            const badge = key === 'new' ? groups.new.length : 0;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-bold transition-colors ${
                  tab === key
                    ? 'border-primary bg-primary text-white shadow-[0_4px_12px_-3px_rgba(124,58,237,0.5)]'
                    : 'border-sand bg-white text-ink-soft active:bg-sand-soft'
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
              <div className="card p-6 text-center">
                <div className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">
                  {t('sk.history.cash')}
                </div>
                <div className="mt-1 text-4xl font-extrabold tracking-tight text-go">₹{cashToday}</div>
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
    <div className="card flex flex-col items-center gap-4 p-6 text-center">
      <h3 className="text-lg font-extrabold tracking-tight">{t('qr.title')}</h3>
      <p className="text-sm text-ink-soft">{t('qr.sub')}</p>
      <QrImage
        text={url}
        size={512}
        alt="Shop QR code"
        className="h-52 w-52 rounded-xl2 border border-sand p-2 shadow-card"
      />
      <code className="break-all rounded-lg bg-sand-soft px-3 py-1.5 text-xs">{url}</code>
      <Link
        to={`/p/${shop.slug}`}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.5)] transition-transform active:scale-[0.98] active:bg-primary-dark"
      >
        <Printer size={18} /> {t('qr.openPoster')}
      </Link>
      <p className="text-xs text-ink-faint">{t('qr.reprintNote')}</p>
    </div>
  );
}

function Empty({ text }) {
  return (
    <p className="rounded-xl2 border-2 border-dashed border-sand px-4 py-12 text-center text-base text-ink-soft">
      {text}
    </p>
  );
}
