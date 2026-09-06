import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { Button } from '../components/Button.jsx';

export function Account({ user, onSignOut }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  async function signOut() {
    await onSignOut();
    navigate('/shops');
  }

  return (
    <div className="min-h-screen pb-24">
      <TopBar user={user} />
      <main className="mx-auto max-w-md px-4 py-6">
        <h1 className="text-2xl font-bold">{t('account.title')}</h1>

        <dl className="mt-5 divide-y divide-sand rounded-xl2 border-2 border-sand bg-white px-4">
          <div className="flex items-center justify-between py-4">
            <dt className="text-base text-ink-soft">{t('account.phone')}</dt>
            <dd className="text-lg font-bold">{user.phone_number}</dd>
          </div>
        </dl>

        <div className="mt-6 space-y-3">
          <Button icon="🏪" variant="ghost" onClick={() => navigate('/shops')}>
            {t('account.backToShops')}
          </Button>
          <Button icon="🚪" onClick={signOut}>
            {t('account.signOut')}
          </Button>
        </div>
      </main>
    </div>
  );
}
