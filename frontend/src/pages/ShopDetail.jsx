import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, MapPin, Plus, Check } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { api } from '../lib/api.js';
import { formatItemPrice } from '../lib/price.js';
import { isWithinHours, opensAtLabel } from '../lib/shopHours.js';
import { TopBar } from '../components/TopBar.jsx';
import { OpenBadge } from '../components/Badge.jsx';
import { VoiceOrder } from '../components/shopper/VoiceOrder.jsx';
import { CartBar } from '../components/shopper/CartBar.jsx';

function InventoryRow({ item, shopSlug, accepting }) {
  const { t, lang } = useI18n();
  const { cartForShop, addToCart } = useStore();
  const primary = lang === 'ta' && item.name_ta ? item.name_ta : item.name;
  const secondary = lang === 'ta' && item.name_ta ? item.name : item.name_ta;
  const priceText = formatItemPrice(item, t);
  const inCart = cartForShop(shopSlug).some((l) => l.id === item.id);
  const stock = item.stock_amount ?? item.stock_qty ?? 0;

  const addLine = () => ({
    id: item.id,
    name: item.name,
    name_ta: item.name_ta,
    pack_size: item.pack_size,
    unit_price: item.price ?? item.price_min ?? 0,
    qty: item.sell_by === 'weight' ? item.min_qty || item.step_qty || 0.25 : 1,
    sell_by: item.sell_by || 'pack',
    unit: item.sell_by === 'weight' ? item.base_unit || 'kg' : item.sell_by === 'piece' ? 'pcs' : 'pack',
    price_basis: item.price_basis,
    base_unit: item.base_unit,
    min_qty: item.min_qty,
    max_qty: item.max_qty,
    step_qty: item.step_qty,
  });

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl2 bg-cream text-2xl">
        {item.icon || '🛒'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-bold">{primary}</span>
          <span className="text-sm text-ink-soft">{item.pack_size}</span>
        </div>
        {secondary && <div className="text-sm text-ink-soft">{secondary}</div>}
        {item.sell_by === 'weight' && (
          <div className="text-xs text-ink-soft">{t('shop.soldLoose')}</div>
        )}
        {!item.in_stock ? (
          <div className="text-sm font-bold text-stop">{t('shop.outOfStock')}</div>
        ) : stock <= 5 ? (
          <div className="text-sm font-semibold text-warn">{t('shop.left', { n: stock })}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {priceText ? (
          <span
            className={`text-lg font-extrabold ${
              item.in_stock ? 'text-ink' : 'text-ink-soft line-through'
            } ${item.price_mode === 'range' ? 'text-base' : ''}`}
          >
            {priceText}
          </span>
        ) : (
          <span className="text-sm font-semibold text-ink-soft">{t('shop.priceAtCounter')}</span>
        )}
        {item.in_stock && accepting && (
          <button
            onClick={() => addToCart(shopSlug, addLine())}
            className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${
              inCart ? 'bg-go/15 text-go' : 'bg-primary text-white active:bg-primary-dark'
            }`}
          >
            {inCart ? <Check size={14} /> : <Plus size={14} />}
            {inCart ? t('shop.added') : item.sell_by === 'weight' ? t('shop.addWeight', { q: item.min_qty || item.step_qty || 0.25, u: item.base_unit || 'kg' }) : t('shop.add')}
          </button>
        )}
      </div>
    </li>
  );
}

export function ShopDetail({ user }) {
  const { slug } = useParams();
  const { t } = useI18n();
  const [state, setState] = useState({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const [{ shop }, inv] = await Promise.all([
        api(`/shops/${slug}`),
        api(`/shops/${slug}/inventory`),
      ]);
      setState({ status: 'ok', shop, items: inv.items });
    } catch (e) {
      setState({ status: 'error', code: e.code });
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    if (state.status !== 'ok') return [];
    const by = new Map();
    for (const it of state.items) {
      if (!by.has(it.category)) by.set(it.category, []);
      by.get(it.category).push(it);
    }
    return [...by.entries()];
  }, [state]);

  const shop = state.status === 'ok' ? state.shop : null;
  const withinHours = shop ? isWithinHours(shop.opening_hours) : true;
  const accepting = Boolean(shop && shop.is_open && withinHours);

  return (
    <div className="min-h-screen pb-32">
      <TopBar user={user} />
      <main className="mx-auto max-w-md px-4 py-5">
        <Link to="/shops" className="inline-flex items-center gap-1 text-base font-semibold text-ink-soft">
          <ChevronLeft size={18} /> {t('shop.back')}
        </Link>

        {state.status === 'loading' && (
          <p className="py-10 text-center text-lg text-ink-soft">{t('common.loading')}</p>
        )}

        {state.status === 'error' && (
          <p className="py-10 text-center text-lg text-stop">
            ⚠️ {t(`error.${state.code}`) !== `error.${state.code}` ? t(`error.${state.code}`) : t('common.error')}
          </p>
        )}

        {state.status === 'ok' && (
          <>
            <div className="mt-3">
              <h1 className="text-2xl font-extrabold">{state.shop.shop_name}</h1>
              <p className="text-base text-ink-soft">{state.shop.category}</p>
              <div className="mt-2 flex items-center gap-2">
                <OpenBadge open={accepting} />
                {state.shop.distance_km != null && (
                  <span className="text-sm font-semibold text-ink-soft">
                    📍 {t('shops.away', { km: state.shop.distance_km })}
                  </span>
                )}
              </div>
              {state.shop.address && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft">
                  <MapPin size={15} /> {state.shop.address}
                </p>
              )}
            </div>

            {!accepting && (
              <p className="mt-4 rounded-xl2 bg-stop/10 px-4 py-3 text-base font-semibold text-stop">
                {!state.shop.is_open
                  ? t('shop.closedBanner')
                  : opensAtLabel(state.shop.opening_hours)
                    ? t('shop.closedUntil', { time: opensAtLabel(state.shop.opening_hours) })
                    : t('shop.closedBanner')}
              </p>
            )}

            {state.shop.price_mode === 'range' && (
              <p className="mt-3 text-sm text-ink-soft">ⓘ {t('shop.priceRangeNote')}</p>
            )}
            {state.shop.price_mode === 'hidden' && (
              <p className="mt-3 text-sm text-ink-soft">ⓘ {t('shop.priceHiddenNote')}</p>
            )}

            {state.items.length > 0 && (
              <div className="mt-4">
                <VoiceOrder shop={state.shop} items={state.items} />
              </div>
            )}

            <p className="mt-4 text-base font-bold text-ink-soft">
              {t('shop.items', { n: state.items.length })}
            </p>

            {state.items.length === 0 ? (
              <p className="py-8 text-center text-ink-soft">{t('shop.noItems')}</p>
            ) : (
              <div className="mt-2 space-y-5">
                {groups.map(([cat, items]) => (
                  <section key={cat}>
                    <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
                      {cat}
                    </h2>
                    <ul className="divide-y divide-sand rounded-xl2 border-2 border-sand bg-white px-4">
                      {items.map((it) => (
                        <InventoryRow
                          key={it.id}
                          item={it}
                          shopSlug={state.shop.slug}
                          accepting={accepting}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {state.status === 'ok' && accepting && <CartBar shop={state.shop} />}
    </div>
  );
}
