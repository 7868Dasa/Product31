import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { api, auth, ApiError } from '../lib/api.js';
import { Button } from '../components/Button.jsx';
import { LangToggle } from '../components/LangToggle.jsx';

const STEP = { PHONE: 'phone', OTP: 'otp' };

export function Login({ onSignedIn }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(STEP.PHONE);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const showErr = (e) => {
    const code = e instanceof ApiError ? e.code : 'generic';
    setErr(t(`error.${code}`) === `error.${code}` ? t('error.generic') : t(`error.${code}`));
  };

  async function sendCode(e) {
    e?.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await api('/auth/otp/request', { method: 'POST', body: { phone_number: phone } });
      setDevOtp(res.dev_otp ?? null);
      setStep(STEP.OTP);
    } catch (e2) {
      showErr(e2);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e?.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await api('/auth/otp/verify', {
        method: 'POST',
        body: { phone_number: phone, otp_code: otp },
      });
      auth.set(res);
      onSignedIn(res.user);
      navigate('/shops');
    } catch (e2) {
      showErr(e2);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-5 pb-8 pt-safe">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-0 -z-10 h-96 w-96 translate-x-1/3 rounded-[100%] bg-primary/10 blur-[90px]"
      />
      <header className="mb-8 flex items-center justify-between pt-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">{t('app.name')}</h1>
          <p className="text-base text-ink-soft">{t('app.tagline')}</p>
        </div>
        <LangToggle />
      </header>

      <main className="flex flex-1 flex-col justify-center">
        <h2 className="mb-6 text-2xl font-extrabold tracking-tight">{t('login.title')}</h2>

        {step === STEP.PHONE && (
          <form onSubmit={sendCode} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-lg font-semibold">📱 {t('login.phoneLabel')}</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('login.phonePlaceholder')}
                className="w-full rounded-xl2 border border-sand bg-white px-4 py-4 text-2xl tracking-wide shadow-card outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_4px_rgba(124,58,237,0.12)]"
              />
            </label>
            <Button type="submit" icon="➡️" disabled={busy || phone.replace(/\D/g, '').length < 10}>
              {busy ? t('login.sending') : t('login.sendCode')}
            </Button>
          </form>
        )}

        {step === STEP.OTP && (
          <form onSubmit={verify} className="space-y-5">
            <p className="text-base text-ink-soft">{t('login.otpHint', { phone })}</p>
            {devOtp && (
              <p className="rounded-lg bg-primary-tint px-3 py-2 text-base font-semibold text-primary-dark">
                {t('login.devCode', { code: devOtp })}
              </p>
            )}
            <label className="block">
              <span className="mb-2 block text-lg font-semibold">🔑 {t('login.otpLabel')}</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-xl2 border border-sand bg-white px-4 py-4 text-center text-4xl tracking-[0.4em] shadow-card outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_4px_rgba(124,58,237,0.12)]"
              />
            </label>
            <Button type="submit" icon="✅" disabled={busy || otp.length < 4}>
              {busy ? t('login.verifying') : t('login.verify')}
            </Button>
            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => { setStep(STEP.PHONE); setOtp(''); setErr(null); }} className="text-base font-semibold text-ink-soft underline">
                {t('login.changeNumber')}
              </button>
              <button type="button" onClick={sendCode} disabled={busy} className="text-base font-semibold text-primary underline">
                {t('login.resend')}
              </button>
            </div>
          </form>
        )}

        {err && (
          <p role="alert" className="mt-5 rounded-lg bg-stop/10 px-4 py-3 text-base font-semibold text-stop">
            ⚠️ {err}
          </p>
        )}

        <button
          type="button"
          onClick={() => navigate('/shops')}
          className="mt-8 text-base font-semibold text-ink-soft underline"
        >
          👀 {t('login.skip')}
        </button>
      </main>
    </div>
  );
}
