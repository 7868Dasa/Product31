import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { api, ApiError } from '../lib/api.js';
import { CONSENT_VERSION } from '../lib/consent.js';
import { LangToggle } from '../components/LangToggle.jsx';

function Check({ checked, onChange, children, required }) {
  return (
    <label className="flex items-start gap-3 rounded-xl2 border-2 border-sand bg-white p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
      />
      <span className="text-sm">
        {children}
        {required && <span className="ml-1 font-bold text-stop">*</span>}
      </span>
    </label>
  );
}

export function Consent({ user, onUpdated, source = 'signup' }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [tos, setTos] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [age, setAge] = useState(false);
  const [location, setLocation] = useState(user?.location_consent ?? false);
  const [marketing, setMarketing] = useState(user?.marketing_consent ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const canSubmit = tos && privacy && age && !busy;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { user: updated } = await api('/users/me/consent', {
        method: 'POST',
        authed: true,
        body: {
          consent_version: CONSENT_VERSION,
          tos: true,
          privacy: true,
          age_confirmed: true,
          location,
          marketing,
          source,
        },
      });
      onUpdated?.(updated);
      navigate('/shops');
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-8">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" />
          <h1 className="text-xl font-extrabold">{t('consent.title')}</h1>
        </div>
        <LangToggle />
      </header>

      <p className="mb-4 text-sm text-ink-soft">{t('consent.intro')}</p>

      <form onSubmit={submit} className="space-y-3">
        <Check checked={tos} onChange={setTos} required>
          {t('consent.tosPre')}{' '}
          <Link to="/legal/terms" className="font-semibold text-primary underline">
            {t('consent.tos')}
          </Link>{' '}
          {t('consent.and')}{' '}
          <Link to="/legal/privacy" className="font-semibold text-primary underline">
            {t('consent.privacy')}
          </Link>
          .
        </Check>
        <Check checked={privacy} onChange={setPrivacy} required>
          {t('consent.dataUse')}
        </Check>
        <Check checked={age} onChange={setAge} required>
          {t('consent.age')}
        </Check>

        <p className="pt-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
          {t('consent.optional')}
        </p>
        <Check checked={location} onChange={setLocation}>
          {t('consent.location')}
        </Check>
        <Check checked={marketing} onChange={setMarketing}>
          {t('consent.marketing')}
        </Check>

        {err && <p className="text-sm font-semibold text-stop">⚠️ {err}</p>}

        <button
          disabled={!canSubmit}
          className="w-full rounded-full bg-primary py-3.5 text-lg font-semibold text-white disabled:opacity-50"
        >
          {busy ? t('common.loading') : t('consent.agree')}
        </button>
        <p className="text-center text-xs text-ink-soft">{t('consent.withdraw')}</p>
      </form>
    </div>
  );
}
