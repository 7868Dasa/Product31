import { useI18n } from '../i18n/index.jsx';

export function OpenBadge({ open, className = '' }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
        open ? 'bg-go/15 text-go' : 'bg-stop/15 text-stop'
      } ${className}`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${open ? 'bg-go' : 'bg-stop'}`} aria-hidden="true" />
      {open ? t('shops.open') : t('shops.closed')}
    </span>
  );
}
