import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Store, Bell, BellOff, ChefHat, Boxes, QrCode, IndianRupee, ArrowLeftRight, Printer, Settings, Check } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { useStore } from '../../store.jsx';
import { LangToggle } from '../../components/LangToggle.jsx';
import { OrderCard } from '../../components/shopkeeper/OrderCard.jsx';
import { CatalogManager } from '../../components/shopkeeper/CatalogManager.jsx';
import { QrImage } from '../../components/QrImage.jsx';
import { shopShareUrl } from '../../lib/qr.js';
import { PREP_OPTIONS } from '../../lib/shopHours.js';
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

// Primary destinations — a fixed bottom bar (mobile-app pattern), so every
// tab is visible and thumb-reachable instead of hidden in a scrolling row.
const NAV_TABS = [
  { key: 'new', icon: Bell },
  { key: 'active', icon: ChefHat },
  { key: 'stock', icon: Boxes },
  { key: 'history', icon: IndianRupee },
  { key: 'qr', icon: QrCode },
  { key: 'settings', icon: Settings },
];

function BottomTabs({ tab, setTab, newCount, t }) {
  return (
    <nav className="frost fixed inset-x-0 bottom-0 z-40 border-t border-sand/60 pb-safe">
      <div className="mx-auto flex max-w-2xl">
        {NAV_TABS.map(({ key, icon: Icon }) => {
          const on = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={on ? 'page' : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center justify-start gap-0.5 px-0.5 pb-1.5 pt-2 transition-colors ${
                on ? 'text-primary' : 'text-ink-faint active:text-ink-soft'
              }`}
            >
              <span className="relative">
                <Icon size={22} strokeWidth={on ? 2.5 : 2} />
                {key === 'new' && newCount > 0 && (
                  <span className="absolute -right-2.5 -top-1 min-w-[16px] rounded-full bg-stop px-1 text-center text-[10px] font-extrabold leading-4 text-white">
                    {newCount}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-[10px] font-bold leading-none">
                {t(`sk.tab.${key}`)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Dashboard() {
  const { t } = useI18n();
  const {
    myShop,
    ordersForShop,
    refreshQueue,
    refreshMyShop,
    isShopOpen,
    toggleShopOpen,
    updateMyShop,
    acceptOrder,
    rejectOrder,
    markReady,
    markCollected,
    flagUnavailable,
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
      active: orders.filter((o) =>
        ['ACCEPTED', 'PENDING_CONFIRMATION', 'READY_FOR_PICKUP'].includes(o.status),
      ),
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
    onFlagUnavailable: (id, itemIds) => flagUnavailable(id, itemIds).catch(onErr),
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

          {tab === 'settings' && <SettingsPanel shop={shop} t={t} onSave={updateMyShop} />}
        </div>
      </div>

      <BottomTabs tab={tab} setTab={setTab} newCount={groups.new.length} t={t} />
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

function SettingsPanel({ shop, t, onSave }) {
  const [prep, setPrep] = useState(shop.prep_time_minutes ?? 10);
  const [auto, setAuto] = useState(!!shop.auto_confirm);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = prep !== (shop.prep_time_minutes ?? 10) || auto !== !!shop.auto_confirm;

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      await onSave({ prep_time_minutes: Number(prep), auto_confirm: auto });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-5 p-5">
      <h3 className="text-lg font-extrabold tracking-tight">{t('sk.settings.title')}</h3>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">{t('sk.settings.prep')}</span>
        <select
          value={prep}
          onChange={(e) => setPrep(Number(e.target.value))}
          className="w-full appearance-none rounded-xl2 border border-sand bg-white px-4 py-3 text-base shadow-card outline-none focus:border-primary"
        >
          {PREP_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {t('onb.prepMins', { n })}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-ink-soft">{t('sk.settings.prepHint')}</span>
      </label>

      <label className="flex items-start gap-3 rounded-xl2 border border-sand bg-white px-4 py-3 shadow-card">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
          checked={auto}
          onChange={(e) => setAuto(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold">{t('sk.settings.autoConfirm')}</span>
          <span className="mt-0.5 block text-xs text-ink-soft">{t('sk.settings.autoConfirmHint')}</span>
        </span>
      </label>

      {auto && shop.price_display_mode === 'hidden' && (
        <p className="rounded-xl2 border border-stop/30 bg-stop/5 px-3 py-2 text-xs font-medium text-stop">
          {t('sk.settings.autoConfirmHiddenWarn')}
        </p>
      )}

      <button
        onClick={save}
        disabled={busy || !dirty}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-white transition-transform active:scale-[0.98] active:bg-primary-dark disabled:opacity-50"
      >
        {saved ? (
          <>
            <Check size={18} /> {t('sk.settings.saved')}
          </>
        ) : busy ? (
          t('common.loading')
        ) : (
          t('sk.settings.save')
        )}
      </button>
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
