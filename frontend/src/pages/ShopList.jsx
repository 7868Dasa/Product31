import { useState, useEffect, useCallback, useMemo } from 'react';
import { Star } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { api } from '../lib/api.js';
import { TopBar } from '../components/TopBar.jsx';
import { ShopCard } from '../components/ShopCard.jsx';
import { orderCategories } from '../lib/categories.js';
import {
  DEFAULT_LOCATION,
  initialLocation,
  requestBrowserLocation,
  saveLocation,
} from '../lib/location.js';

const RADII = [5, 15, 25];

export function ShopList({ user }) {
  const { t } = useI18n();
  const { favShops, refreshFavShops } = useStore();
  const [loc, setLoc] = useState(initialLocation);
  const [radius, setRadius] = useState(5);
  const [state, setState] = useState({ status: 'loading', shops: [] });
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(false);
  const [cat, setCat] = useState(null); // selected category filter, or null = all

  const load = useCallback(async (l, r) => {
    setState({ status: 'loading', shops: [] });
    try {
      const res = await api(`/shops?lat=${l.lat}&lng=${l.lng}&radius_km=${r}`);
      setState({ status: 'ok', shops: res.shops });
    } catch {
      setState({ status: 'error', shops: [] });
    }
  }, []);

  useEffect(() => {
    load(loc, radius);
  }, [load, loc, radius]);

  useEffect(() => {
    refreshFavShops();
  }, [refreshFavShops]);

  async function useMyLocation() {
    setLocating(true);
    setLocError(false);
    try {
      const here = await requestBrowserLocation();
      saveLocation(here);
      setLoc(here);
    } catch {
      setLocError(true);
      setLoc(DEFAULT_LOCATION);
    } finally {
      setLocating(false);
    }
  }

  const locLabel = loc.label ? t('shops.near', { label: loc.label }) : t('shops.nearGps');

  // Category chips — a discovery FILTER only. No ranking, no price. Derived
  // from whatever shop types are actually nearby.
  const cats = useMemo(() => {
    const seen = new Set();
    for (const s of state.shops) if (s.category) seen.add(s.category);
    return orderCategories(seen); // fixed display order: Grocery, Bakery, Supermarket, Retail, Tea Shop…
  }, [state.shops]);

  const visible = useMemo(
    () => (cat ? state.shops.filter((s) => s.category === cat) : state.shops),
    [state.shops, cat],
  );

  return (
    <div className="min-h-dvh pb-nav">
      <TopBar user={user} />
      <main className="mx-auto max-w-md px-4 py-5">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('shops.title')}</h1>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-base text-ink-soft">📍 {locLabel}</span>
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="rounded-full border border-primary px-3 py-1.5 text-sm font-bold text-primary transition-transform active:scale-95 active:bg-primary-tint disabled:opacity-60"
          >
            {locating ? t('shops.locating') : `🎯 ${t('shops.useMyLocation')}`}
          </button>
        </div>
        {locError && (
          <p className="mt-2 rounded-xl bg-primary-tint px-3 py-2 text-sm text-primary-dark">
            {t('shops.locationDenied', { label: DEFAULT_LOCATION.label })}
          </p>
        )}

        {favShops.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-ink-faint">
              <Star size={14} className="text-primary" fill="currentColor" /> {t('shops.myShops')}
            </h2>
            <div className="space-y-3">
              {favShops.map((s) => (
                <div key={s.slug} className="animate-fade-up">
                  <ShopCard shop={s} />
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 flex gap-2">
          {RADII.map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                radius === r
                  ? 'bg-primary text-white shadow-[0_4px_12px_-3px_rgba(124,58,237,0.5)]'
                  : 'border border-sand bg-white text-ink-soft active:bg-sand-soft'
              }`}
            >
              {r} km
            </button>
          ))}
        </div>

        {cats.length > 1 && (
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setCat(null)}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                cat === null
                  ? 'bg-primary text-white shadow-[0_4px_12px_-3px_rgba(124,58,237,0.5)]'
                  : 'border border-sand bg-white text-ink-soft active:bg-sand-soft'
              }`}
            >
              {t('shops.allTypes')}
            </button>
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c === cat ? null : c)}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  cat === c
                    ? 'bg-primary text-white shadow-[0_4px_12px_-3px_rgba(124,58,237,0.5)]'
                    : 'border border-sand bg-white text-ink-soft active:bg-sand-soft'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-3">
          {state.status === 'loading' && (
            <p className="py-8 text-center text-lg text-ink-soft">{t('shops.searching')}</p>
          )}

          {state.status === 'error' && (
            <div className="py-8 text-center">
              <p className="text-lg text-stop">⚠️ {t('common.error')}</p>
              <button
                onClick={() => load(loc, radius)}
                className="mt-3 rounded-xl2 bg-primary px-5 py-3 font-bold text-white shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] transition-transform active:scale-95"
              >
                {t('shops.retry')}
              </button>
            </div>
          )}

          {state.status === 'ok' && state.shops.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-lg text-ink-soft">{t('shops.none', { km: radius })}</p>
              {radius < 25 && (
                <button
                  onClick={() => setRadius(RADII[RADII.indexOf(radius) + 1] ?? 25)}
                  className="mt-3 rounded-xl2 bg-primary px-5 py-3 font-bold text-white shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] transition-transform active:scale-95"
                >
                  {t('shops.widen')}
                </button>
              )}
            </div>
          )}

          {state.status === 'ok' && state.shops.length > 0 && visible.length === 0 && (
            <p className="py-8 text-center text-ink-soft">{t('shops.noneOfType', { type: cat })}</p>
          )}

          {state.status === 'ok' &&
            visible.map((s) => (
              <div key={s.slug} className="animate-fade-up">
                <ShopCard shop={s} />
              </div>
            ))}
        </div>
      </main>
    </div>
  );
}
