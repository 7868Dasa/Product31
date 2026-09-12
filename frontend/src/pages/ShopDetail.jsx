import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, MapPin, Plus, Check, Store, Star } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { api } from '../lib/api.js';
import { formatItemPrice } from '../lib/price.js';
import { isWithinHours, opensAtLabel } from '../lib/shopHours.js';
import { TopBar } from '../components/TopBar.jsx';
import { OpenBadge } from '../components/Badge.jsx';
import { VoiceOrder } from '../components/shopper/VoiceOrder.jsx';
import { CartBar } from '../components/shopper/CartBar.jsx';

const catId = (cat) => `cat-${String(cat).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

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
    <li className="flex items-center gap-3 py-3.5">
      <div className="chip-icon h-12 w-12 shrink-0 bg-sand-soft text-2xl">{item.icon || '🛒'}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-bold tracking-tight">{primary}</span>
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
            className={`font-extrabold ${
              item.in_stock ? 'text-ink' : 'text-ink-soft line-through'
            } ${item.price_mode === 'range' ? 'text-base' : 'text-lg'}`}
          >
            {priceText}
          </span>
        ) : (
          <span className="text-sm font-semibold text-ink-soft">{t('shop.priceAtCounter')}</span>
        )}
        {item.in_stock && accepting && (
          <button
            onClick={() => addToCart(shopSlug, addLine())}
            className={`flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-bold transition-transform active:scale-90 ${
              inCart
                ? 'bg-go/15 text-go'
                : 'bg-primary text-white shadow-[0_4px_12px_-3px_rgba(124,58,237,0.55)] active:bg-primary-dark'
            }`}
          >
            {inCart ? <Check size={14} /> : <Plus size={14} />}
            {inCart
              ? t('shop.added')
              : item.sell_by === 'weight'
                ? t('shop.addWeight', { q: item.min_qty || item.step_qty || 0.25, u: item.base_unit || 'kg' })
                : t('shop.add')}
          </button>
        )}
      </div>
    </li>
  );
}

/** Horizontal aisle chips — jump to a category section within THIS shop. */
function AisleNav({ cats }) {
  const [active, setActive] = useState(cats[0]);
  const barRef = useRef(null);
  const lockRef = useRef(0); // ignore scroll-spy briefly after a chip tap

  useEffect(() => {
    const secs = cats.map((c) => document.getElementById(catId(c))).filter(Boolean);
    if (!secs.length) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lockRef.current) return;
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.dataset.cat);
      },
      { rootMargin: '-150px 0px -55% 0px', threshold: 0 },
    );
    secs.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [cats]);

  const jump = (c) => {
    setActive(c);
    lockRef.current = Date.now() + 700;
    document.getElementById(catId(c))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // keep the active chip in view within the scroller
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const el = bar.querySelector(`[data-chip="${active}"]`);
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [active]);

  if (cats.length < 2) return null;

  return (
    <div className="frost sticky top-[52px] z-20 -mx-4 mt-3 border-b border-sand/50 px-4 py-2.5">
      <div ref={barRef} className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cats.map((c) => (
          <button
            key={c}
            data-chip={c}
            onClick={() => jump(c)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              active === c
                ? 'bg-primary text-white shadow-[0_4px_12px_-3px_rgba(124,58,237,0.5)]'
                : 'border border-sand bg-white text-ink-soft active:bg-sand-soft'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShopDetail({ user }) {
  const { slug } = useParams();
  const { t, lang } = useI18n();
  const { isFavShop, toggleFavShop } = useStore();
  const [state, setState] = useState({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const [{ shop }, inv] = await Promise.all([api(`/shops/${slug}`), api(`/shops/${slug}/inventory`)]);
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
    // Alphabetise the items within each aisle by whatever name is on screen
    // (Tamil name in Tamil mode, else English) — categories keep their own
    // order (Essentials-first etc.), only the article list within one sorts.
    const displayName = (it) => (lang === 'ta' && it.name_ta ? it.name_ta : it.name) || '';
    const collator = new Intl.Collator(lang === 'ta' ? 'ta' : 'en', { sensitivity: 'base' });
    for (const items of by.values()) {
      items.sort((a, b) => collator.compare(displayName(a), displayName(b)));
    }
    return [...by.entries()];
  }, [state, lang]);

  const shop = state.status === 'ok' ? state.shop : null;
  const withinHours = shop ? isWithinHours(shop.opening_hours) : true;
  const accepting = Boolean(shop && shop.is_open && withinHours);

  return (
    <div className="min-h-dvh pb-nav">
      <TopBar user={user} />
      <main className="mx-auto max-w-md px-4 py-4">
        <Link
          to="/shops"
          className="inline-flex items-center gap-1 text-base font-semibold text-ink-soft transition-transform active:-translate-x-0.5"
        >
          <ChevronLeft size={18} /> {t('shop.back')}
        </Link>

        {state.status === 'loading' && (
          <p className="py-10 text-center text-lg text-ink-soft">{t('common.loading')}</p>
        )}

        {state.status === 'error' && (
          <p className="py-10 text-center text-lg text-stop">
            ⚠️{' '}
            {t(`error.${state.code}`) !== `error.${state.code}` ? t(`error.${state.code}`) : t('common.error')}
          </p>
        )}

        {state.status === 'ok' && (
          <>
            <div className="mt-3 flex items-start gap-3">
              <div className="chip-icon h-14 w-14 shrink-0 text-primary">
                <Store size={26} strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-extrabold tracking-tight">{state.shop.shop_name}</h1>
                <p className="text-base text-ink-soft">{state.shop.category}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <OpenBadge open={accepting} />
                  {state.shop.distance_km != null && (
                    <span className="text-sm font-semibold text-ink-soft">
                      📍 {t('shops.away', { km: state.shop.distance_km })}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleFavShop(state.shop)}
                aria-pressed={isFavShop(state.shop.slug)}
                aria-label={isFavShop(state.shop.slug) ? t('shops.unfav') : t('shops.fav')}
                className={`-mt-1 -mr-1 shrink-0 rounded-full p-2 transition-transform active:scale-90 ${
                  isFavShop(state.shop.slug) ? 'text-primary' : 'text-ink-faint'
                }`}
              >
                <Star
                  size={24}
                  fill={isFavShop(state.shop.slug) ? 'currentColor' : 'none'}
                  strokeWidth={2}
                />
              </button>
            </div>
            {state.shop.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  state.shop.latitude != null && state.shop.longitude != null
                    ? `${state.shop.latitude},${state.shop.longitude}`
                    : `${state.shop.shop_name} ${state.shop.address}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('shop.openInMaps')}
                className="mt-2.5 flex items-center gap-1.5 text-sm font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-opacity active:opacity-60"
              >
                <MapPin size={15} className="shrink-0" /> {state.shop.address}
              </a>
            )}

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

            {state.items.length === 0 ? (
              <p className="py-10 text-center text-ink-soft">{t('shop.noItems')}</p>
            ) : (
              <>
                <AisleNav cats={groups.map(([c]) => c)} />

                <p className="mt-3 text-sm font-bold uppercase tracking-wide text-ink-faint">
                  {t('shop.items', { n: state.items.length })}
                </p>

                <div className="mt-2 space-y-6">
                  {groups.map(([cat, items]) => (
                    <section
                      key={cat}
                      id={catId(cat)}
                      data-cat={cat}
                      className="scroll-mt-[150px] animate-fade-up"
                    >
                      <h2 className="mb-1.5 text-sm font-extrabold uppercase tracking-wide text-ink-soft">
                        {cat}
                      </h2>
                      <ul className="card divide-y divide-sand/70 px-4">
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
              </>
            )}
          </>
        )}
      </main>

      {state.status === 'ok' && accepting && <CartBar shop={state.shop} />}
    </div>
  );
}
