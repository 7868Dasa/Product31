import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { OpenBadge } from './Badge.jsx';

export function ShopCard({ shop }) {
  const { t } = useI18n();
  return (
    <Link
      to={`/s/${shop.slug}`}
      className="flex items-center gap-4 rounded-xl2 border-2 border-sand bg-white p-4 active:bg-sand"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl2 bg-primary-tint text-3xl">
        🏪
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xl font-bold">{shop.shop_name}</div>
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
      <span aria-hidden="true" className="text-2xl text-ink-soft">
        ›
      </span>
    </Link>
  );
}
