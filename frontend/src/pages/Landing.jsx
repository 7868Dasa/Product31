import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Store, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { LangToggle } from '../components/LangToggle.jsx';

const DEMO = import.meta.env.VITE_DEMO === 'true';

function RoleCard({ icon: Icon, title, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-xl2 border-2 border-sand bg-white p-5 text-left transition-colors active:bg-sand"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
        <Icon size={26} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold">{title}</span>
        <span className="block text-base text-ink-soft">{sub}</span>
      </span>
      <ArrowRight size={22} className="shrink-0 text-ink-soft" />
    </button>
  );
}

export function Landing() {
  const { t } = useI18n();
  const { setRole, myShop } = useStore();
  const navigate = useNavigate();

  const go = (role, path) => {
    setRole(role);
    navigate(path);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-primary">{t('app.name')}</h1>
          <p className="text-base text-ink-soft">{t('app.tagline')}</p>
        </div>
        <LangToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center gap-4">
        <h2 className="text-2xl font-bold">{t('landing.chooseRole')}</h2>
        <RoleCard
          icon={ShoppingBag}
          title={t('landing.shopper')}
          sub={t('landing.shopperSub')}
          onClick={() => go('shopper', '/shops')}
        />
        <RoleCard
          icon={Store}
          title={t('landing.shopkeeper')}
          sub={t('landing.shopkeeperSub')}
          onClick={() => go('shopkeeper', myShop ? '/shop' : '/shop/onboarding')}
        />
        {DEMO && <p className="pt-2 text-center text-sm text-ink-soft">{t('landing.demoNote')}</p>}
      </main>
    </div>
  );
}
