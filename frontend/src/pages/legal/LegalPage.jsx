import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';

/**
 * Shell for the draft legal pages. Content below is a STARTING POINT and is
 * marked as such in the UI — it must be reviewed and finalised by a qualified
 * Indian lawyer (DPDP Act, Consumer Protection, IT Act) before launch, and
 * translated to Tamil by a native speaker.
 */
export function LegalPage({ titleKey, children }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft">
        <ChevronLeft size={16} /> {t('app.name')}
      </Link>
      <div className="mt-4 rounded-xl2 bg-warn/15 px-4 py-2 text-sm font-semibold text-warn">
        {t('legal.draftBanner')}
      </div>
      <h1 className="mt-4 text-2xl font-extrabold">{t(titleKey)}</h1>
      <div className="prose mt-4 space-y-3 text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}
