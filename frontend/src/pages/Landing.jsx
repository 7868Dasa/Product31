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
      className="card group flex w-full items-center gap-4 p-5 text-left transition-transform duration-150 active:scale-[0.985] active:bg-sand-soft"
    >
      <span className="chip-icon h-14 w-14 shrink-0">
        <Icon size={26} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold tracking-tight">{title}</span>
        <span className="block text-base text-ink-soft">{sub}</span>
      </span>
      <ArrowRight size={22} className="shrink-0 text-ink-faint transition-transform group-active:translate-x-0.5" />
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
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-5 pb-10 pt-safe">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-[36rem] -translate-x-1/2 rounded-[100%] bg-primary/10 blur-[90px]"
      />
      <header className="flex items-center justify-between pt-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">{t('app.name')}</h1>
          <p className="text-base text-ink-soft">{t('app.tagline')}</p>
        </div>
        <LangToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center gap-4">
        <h2 className="text-2xl font-extrabold tracking-tight">{t('landing.chooseRole')}</h2>
        <div className="animate-fade-up">
          <RoleCard
            icon={ShoppingBag}
            title={t('landing.shopper')}
            sub={t('landing.shopperSub')}
            onClick={() => go('shopper', '/shops')}
          />
        </div>
        <div className="animate-fade-up [animation-delay:60ms]">
          <RoleCard
            icon={Store}
            title={t('landing.shopkeeper')}
            sub={t('landing.shopkeeperSub')}
            onClick={() => go('shopkeeper', myShop ? '/shop' : '/shop/onboarding')}
          />
        </div>
        {DEMO && <p className="pt-2 text-center text-sm text-ink-faint">{t('landing.demoNote')}</p>}
      </main>
    </div>
  );
}
