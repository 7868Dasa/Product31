import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { api } from '../lib/api.js';
import { TopBar } from '../components/TopBar.jsx';
import { ShopCard } from '../components/ShopCard.jsx';
import {
  DEFAULT_LOCATION,
  initialLocation,
  requestBrowserLocation,
  saveLocation,
} from '../lib/location.js';

const RADII = [5, 15, 25];

export function ShopList({ user }) {
  const { t } = useI18n();
  const [loc, setLoc] = useState(initialLocation);
  const [radius, setRadius] = useState(5);
  const [state, setState] = useState({ status: 'loading', shops: [] });
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(false);

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

  const locLabel = loc.label
    ? t('shops.near', { label: loc.label })
    : t('shops.nearGps');

  return (
    <div className="min-h-screen pb-24">
      <TopBar user={user} />
      <main className="mx-auto max-w-md px-4 py-5">
        <h1 className="text-2xl font-bold">{t('shops.title')}</h1>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-base text-ink-soft">📍 {locLabel}</span>
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="rounded-full border-2 border-primary px-3 py-1.5 text-sm font-bold text-primary active:bg-primary-tint disabled:opacity-60"
          >
            {locating ? t('shops.locating') : `🎯 ${t('shops.useMyLocation')}`}
          </button>
        </div>
        {locError && (
          <p className="mt-2 rounded-lg bg-primary-tint px-3 py-2 text-sm text-primary-dark">
            {t('shops.locationDenied', { label: DEFAULT_LOCATION.label })}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          {RADII.map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                radius === r ? 'bg-primary text-white' : 'border-2 border-sand bg-white text-ink-soft'
              }`}
            >
              {r} km
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {state.status === 'loading' && (
            <p className="py-8 text-center text-lg text-ink-soft">{t('shops.searching')}</p>
          )}

          {state.status === 'error' && (
            <div className="py-8 text-center">
              <p className="text-lg text-stop">⚠️ {t('common.error')}</p>
              <button
                onClick={() => load(loc, radius)}
                className="mt-3 rounded-xl2 bg-primary px-5 py-3 font-bold text-white"
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
                  className="mt-3 rounded-xl2 bg-primary px-5 py-3 font-bold text-white"
                >
                  {t('shops.widen')}
                </button>
              )}
            </div>
          )}

          {state.status === 'ok' &&
            state.shops.map((s) => <ShopCard key={s.slug} shop={s} />)}
        </div>
      </main>
    </div>
  );
}
