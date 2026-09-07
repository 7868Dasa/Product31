import { Link } from 'react-router-dom';
import { UserRound, LogIn, ArrowLeftRight, ReceiptText } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { LangToggle } from './LangToggle.jsx';

export function TopBar({ user }) {
  const { t } = useI18n();
  const pill =
    'inline-flex items-center gap-1.5 rounded-full border border-sand bg-white px-3 py-2 text-sm font-semibold text-ink-soft shadow-card transition-transform active:scale-95 active:bg-sand-soft';
  return (
    <header className="frost pt-safe sticky top-0 z-30 flex items-center justify-between border-b border-sand/60 px-4 py-2.5">
      <Link to="/shops" className="text-2xl font-extrabold tracking-tight text-primary">
        {t('app.name')}
      </Link>
      <div className="flex items-center gap-2">
        <LangToggle />
        <Link to="/orders" aria-label={t('nav.orders')} className={pill}>
          <ReceiptText size={16} />
        </Link>
        <Link to="/" className={pill} aria-label={t('back.toRoles')}>
          <ArrowLeftRight size={16} />
        </Link>
        <Link to={user ? '/account' : '/login'} className={`${pill} px-4`}>
          {user ? <UserRound size={16} /> : <LogIn size={16} />}
          {user ? t('nav.account') : t('nav.signIn')}
        </Link>
      </div>
    </header>
  );
}
