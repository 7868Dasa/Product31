import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Download, Trash2, MapPin, Mail, FileText } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { Button } from '../components/Button.jsx';
import { Modal } from '../components/Modal.jsx';
import { api, auth, ApiError } from '../lib/api.js';
import { CONSENT_VERSION } from '../lib/consent.js';

function Toggle({ on, onChange, label, icon: Icon }) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center justify-between py-4"
    >
      <span className="flex items-center gap-2 text-base">
        {Icon && <Icon size={16} className="text-ink-soft" />} {label}
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-sand'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}

export function Account({ user, onSignOut, onUserUpdated }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');

  async function signOut() {
    await onSignOut();
    navigate('/shops');
  }

  async function setConsent(patch) {
    setBusy(true);
    setMsg(null);
    try {
      const { user: updated } = await api('/users/me/consent', {
        method: 'POST',
        authed: true,
        body: {
          consent_version: CONSENT_VERSION,
          tos: true,
          privacy: true,
          age_confirmed: true,
          location: user.location_consent ?? false,
          marketing: user.marketing_consent ?? false,
          source: 'settings',
          ...patch,
        },
      });
      onUserUpdated?.(updated);
    } catch {
      setMsg(t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function downloadData() {
    setBusy(true);
    setMsg(null);
    try {
      const data = await api('/users/me/export', { authed: true });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `product31-my-data.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg(t('account.exported'));
    } catch {
      setMsg(t('error.generic'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setMsg(null);
    try {
      await api('/users/me', { method: 'DELETE', authed: true, body: { confirm: 'DELETE' } });
      auth.clear();
      navigate('/');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : t('error.generic'));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh pb-24">
      <TopBar user={user} />
      <main className="mx-auto max-w-md space-y-6 px-4 py-6">
        <h1 className="text-2xl font-bold">{t('account.title')}</h1>

        <dl className="divide-y divide-sand rounded-xl2 border border-sand shadow-card bg-white px-4">
          <div className="flex items-center justify-between py-4">
            <dt className="text-base text-ink-soft">{t('account.phone')}</dt>
            <dd className="text-lg font-bold">{user.phone_number}</dd>
          </div>
        </dl>

        {/* consent toggles (DPDP: withdrawable any time) */}
        <section>
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-soft">
            {t('account.privacy')}
          </h2>
          <div className="divide-y divide-sand rounded-xl2 border border-sand shadow-card bg-white px-4">
            <Toggle
              icon={MapPin}
              label={t('consent.location')}
              on={!!user.location_consent}
              onChange={(v) => setConsent({ location: v })}
            />
            <Toggle
              icon={Mail}
              label={t('consent.marketing')}
              on={!!user.marketing_consent}
              onChange={(v) => setConsent({ marketing: v })}
            />
          </div>
          <div className="mt-2 flex gap-3 text-sm">
            <Link to="/legal/privacy" className="font-semibold text-primary underline">
              {t('consent.privacy')}
            </Link>
            <Link to="/legal/terms" className="font-semibold text-primary underline">
              {t('consent.tos')}
            </Link>
          </div>
        </section>

        {/* data rights */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
            {t('account.yourData')}
          </h2>
          <Button icon={Download} variant="ghost" disabled={busy} onClick={downloadData}>
            {t('account.downloadData')}
          </Button>
          <Button icon={Trash2} variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
            {t('account.deleteAccount')}
          </Button>
        </section>

        {msg && <p className="text-sm font-semibold text-ink-soft">{msg}</p>}

        <div className="space-y-3 border-t border-sand pt-4">
          <Button icon="🏪" variant="ghost" onClick={() => navigate('/shops')}>
            {t('account.backToShops')}
          </Button>
          <Button icon="🚪" onClick={signOut}>
            {t('account.signOut')}
          </Button>
        </div>
      </main>

      {confirmDelete && (
        <Modal
          title={t('account.deleteAccount')}
          onClose={() => setConfirmDelete(false)}
          footer={
            <button
              onClick={deleteAccount}
              disabled={deleteText !== 'DELETE' || busy}
              className="w-full rounded-full bg-stop py-3.5 text-lg font-semibold text-white disabled:opacity-50"
            >
              {t('account.deleteConfirmBtn')}
            </button>
          }
        >
          <p className="text-sm">{t('account.deleteWarn')}</p>
          <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
            <FileText size={14} /> {t('account.deleteKeeps')}
          </p>
          <label className="mt-4 block text-sm font-semibold">
            {t('account.deleteTypePrompt')}
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              className="mt-1 w-full rounded-xl2 border border-sand shadow-card bg-white px-3 py-2.5 text-base outline-none focus:border-stop"
              autoComplete="off"
            />
          </label>
        </Modal>
      )}
    </div>
  );
}
