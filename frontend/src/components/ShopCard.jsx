import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { OpenBadge } from './Badge.jsx';

export function ShopCard({ shop }) {
  const { t } = useI18n();
  const { isFavShop, toggleFavShop } = useStore();
  const fav = isFavShop(shop.slug);

  return (
    <Link
      to={`/s/${shop.slug}`}
      className="card relative flex items-center gap-4 p-4 transition-transform duration-150 active:scale-[0.99] active:bg-sand-soft"
    >
      <div className="chip-icon h-14 w-14 shrink-0 bg-primary-wash text-3xl">🏪</div>
      <div className="min-w-0 flex-1">
        <div className="truncate pr-8 text-xl font-bold tracking-tight">{shop.shop_name}</div>
        <div className="truncate text-base text-ink-soft">{shop.category}</div>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <OpenBadge open={shop.is_open} />
          {shop.distance_km != null && (
            <span className="font-semibold text-ink-soft">
              📍 {t('shops.away', { km: shop.distance_km })}
            </span>
          )}
        </div>
      </div>
      <span aria-hidden="true" className="shrink-0 text-2xl text-ink-faint">
        ›
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavShop(shop);
        }}
        aria-pressed={fav}
        aria-label={fav ? t('shops.unfav') : t('shops.fav')}
        className={`absolute right-2.5 top-2.5 rounded-full p-2 transition-transform active:scale-90 ${
          fav ? 'text-primary' : 'text-ink-faint'
        }`}
      >
        <Star size={20} fill={fav ? 'currentColor' : 'none'} strokeWidth={2} />
      </button>
    </Link>
  );
}
