import { Link } from 'react-router-dom';
import { UserRound, LogIn, ArrowLeftRight } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { LangToggle } from './LangToggle.jsx';

export function TopBar({ user }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sand bg-cream/95 px-4 py-3 backdrop-blur">
      <Link to="/shops" className="text-2xl font-extrabold text-primary">
        {t('app.name')}
      </Link>
      <div className="flex items-center gap-2">
        <LangToggle />
        <Link
          to="/"
          className="inline-flex items-center gap-1 rounded-full border-2 border-sand bg-white px-3 py-2 text-sm font-semibold text-ink-soft active:bg-sand"
          aria-label={t('back.toRoles')}
        >
          <ArrowLeftRight size={16} />
        </Link>
        <Link
          to={user ? '/account' : '/login'}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-sand bg-white px-4 py-2 text-sm font-semibold text-ink-soft active:bg-sand"
        >
          {user ? <UserRound size={16} /> : <LogIn size={16} />}
          {user ? t('nav.account') : t('nav.signIn')}
        </Link>
      </div>
    </header>
  );
}
