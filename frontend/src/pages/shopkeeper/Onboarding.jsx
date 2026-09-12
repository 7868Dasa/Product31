import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Store, MapPin, Check, ArrowRight, Printer, LayoutDashboard } from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { useStore } from '../../store.jsx';
import { api, auth, ApiError } from '../../lib/api.js';
import { requestBrowserLocation } from '../../lib/location.js';
import { shopShareUrl } from '../../lib/qr.js';
import { SHOP_CATEGORIES } from '../../lib/categories.js';
import { PREP_OPTIONS } from '../../lib/shopHours.js';
import { QrImage } from '../../components/QrImage.jsx';
import { LangToggle } from '../../components/LangToggle.jsx';

const input =
  'w-full rounded-xl2 border border-sand bg-white px-4 py-3 text-base shadow-card outline-none transition-shadow focus:border-primary focus:shadow-[0_0_0_4px_rgba(124,58,237,0.12)]';

const PRICE_MODES = ['exact', 'range', 'hidden'];

function Labeled({ label, hint, children }) {
  const { t } = useI18n();
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function Onboarding({ user, onSignedIn }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { adoptShop, useDemoShop } = useStore();

  const [stage, setStage] = useState(user ? 'form' : 'auth');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // auth sub-state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState(null);

  // form state
  const [f, setF] = useState({
    shop_name: '',
    category: '',
    owner_name: '',
    phone_number: '',
    address: '',
    opening_hours: '',
    latitude: '',
    longitude: '',
    price_display_mode: 'exact',
    prep_time_minutes: 10,
    auto_confirm: false,
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const [shop, setShop] = useState(null);

  const showErr = (e) => {
    const code = e instanceof ApiError ? e.code : 'generic';
    const msg = t(`error.${code}`);
    setErr(msg === `error.${code}` ? t('error.generic') : msg);
  };

  async function sendOtp(e) {
    e?.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api('/auth/otp/request', { method: 'POST', body: { phone_number: phone } });
      setDevOtp(r.dev_otp ?? null);
      setOtpSent(true);
    } catch (e2) {
      showErr(e2);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e) {
    e?.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api('/auth/otp/verify', {
        method: 'POST',
        body: { phone_number: phone, otp_code: otp },
      });
      auth.set(r);
      onSignedIn(r.user);
      setF((p) => ({ ...p, phone_number: r.user.phone_number }));
      setStage('form');
    } catch (e2) {
      showErr(e2);
    } finally {
      setBusy(false);
    }
  }

  async function useLocation() {
    setErr(null);
    try {
      const loc = await requestBrowserLocation();
      setF((p) => ({ ...p, latitude: loc.lat.toFixed(6), longitude: loc.lng.toFixed(6) }));
    } catch {
      setErr(t('onb.locFailed'));
    }
  }

  async function submitForm(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = {
        shop_name: f.shop_name.trim(),
        category: f.category.trim(),
        owner_name: f.owner_name.trim(),
        phone_number: f.phone_number.trim(),
        address: f.address.trim(),
        opening_hours: f.opening_hours.trim() || undefined,
        price_display_mode: f.price_display_mode,
        prep_time_minutes: Number(f.prep_time_minutes),
        auto_confirm: !!f.auto_confirm,
        ...(f.latitude && f.longitude
          ? { latitude: Number(f.latitude), longitude: Number(f.longitude) }
          : {}),
      };
      const r = await api('/shops', { method: 'POST', authed: true, body });
      adoptShop(r.shop);
      setShop(r.shop);
      setStage('done');
    } catch (e2) {
      showErr(e2);
    } finally {
      setBusy(false);
    }
  }

  function skipWithDemo() {
    const s = useDemoShop();
    setShop(s);
    setStage('done');
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-safe">
      <header className="mb-6 flex items-center justify-between pt-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-primary"
        >
          <Store size={22} /> {t('app.name')}
        </Link>
        <LangToggle />
      </header>

      {/* ── AUTH ────────────────────────────────────────────────────── */}
      {stage === 'auth' && (
        <main className="flex flex-1 flex-col justify-center">
          <h1 className="mb-2 text-2xl font-bold">{t('onb.authTitle')}</h1>
          <p className="mb-5 text-base text-ink-soft">{t('onb.authSub')}</p>

          {!otpSent ? (
            <form onSubmit={sendOtp} className="space-y-4">
              <Labeled label={t('login.phoneLabel')}>
                <input
                  className={`${input} text-xl tracking-wide`}
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('login.phonePlaceholder')}
                  required
                />
              </Labeled>
              <button
                disabled={busy || phone.replace(/\D/g, '').length < 10}
                className="w-full rounded-full bg-primary py-3.5 text-lg font-semibold text-white disabled:opacity-50"
              >
                {busy ? t('login.sending') : t('login.sendCode')}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <p className="text-sm text-ink-soft">{t('login.otpHint', { phone })}</p>
              {devOtp && (
                <p className="rounded-lg bg-primary-tint px-3 py-2 text-sm font-semibold text-primary-dark">
                  {t('login.devCode', { code: devOtp })}
                </p>
              )}
              <input
                className={`${input} text-center text-3xl tracking-[0.4em]`}
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
              />
              <button
                disabled={busy || otp.length < 4}
                className="w-full rounded-full bg-primary py-3.5 text-lg font-semibold text-white disabled:opacity-50"
              >
                {busy ? t('login.verifying') : t('login.verify')}
              </button>
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="text-sm font-semibold text-ink-soft underline"
              >
                {t('login.changeNumber')}
              </button>
            </form>
          )}
          {err && <p className="mt-4 text-sm font-semibold text-stop">⚠️ {err}</p>}
          <button
            onClick={skipWithDemo}
            className="mt-8 text-sm font-semibold text-ink-soft underline"
          >
            {t('onb.skipDemo')}
          </button>
        </main>
      )}

      {/* ── FORM ────────────────────────────────────────────────────── */}
      {stage === 'form' && (
        <main className="flex-1">
          <h1 className="mb-1 text-2xl font-bold">{t('onb.formTitle')}</h1>
          <p className="mb-5 text-base text-ink-soft">{t('onb.formSub')}</p>

          <form onSubmit={submitForm} className="space-y-4">
            <Labeled label={t('onb.shopName')}>
              <input className={input} value={f.shop_name} onChange={set('shop_name')} required autoFocus />
            </Labeled>
            <Labeled label={t('onb.category')} hint={t('onb.categoryHint')}>
              <select
                className={`${input} appearance-none`}
                value={f.category}
                onChange={set('category')}
                required
              >
                <option value="" disabled>
                  {t('onb.categoryPick')}
                </option>
                {SHOP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label={t('onb.ownerName')}>
                <input className={input} value={f.owner_name} onChange={set('owner_name')} required />
              </Labeled>
              <Labeled label={t('onb.shopPhone')} hint={t('onb.shopPhoneHint')}>
                <input className={input} type="tel" inputMode="numeric" value={f.phone_number} onChange={set('phone_number')} required />
              </Labeled>
            </div>
            <Labeled label={t('onb.address')}>
              <textarea className={input} rows={2} value={f.address} onChange={set('address')} required />
            </Labeled>
            <Labeled label={t('onb.hours')} hint={t('onb.hoursHint')}>
              <input className={input} value={f.opening_hours} onChange={set('opening_hours')} />
            </Labeled>

            <div>
              <span className="mb-1 block text-sm font-semibold">{t('onb.location')}</span>
              <button
                type="button"
                onClick={useLocation}
                className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary py-2.5 text-sm font-bold text-primary active:bg-primary-tint"
              >
                <MapPin size={16} />
                {f.latitude ? t('onb.locSet', { lat: f.latitude, lng: f.longitude }) : t('onb.useLocation')}
              </button>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <input className={input} placeholder="lat" inputMode="decimal" value={f.latitude} onChange={set('latitude')} />
                <input className={input} placeholder="lng" inputMode="decimal" value={f.longitude} onChange={set('longitude')} />
              </div>
            </div>

            <div>
              <span className="mb-1 block text-sm font-semibold">{t('onb.priceMode')}</span>
              <div className="grid grid-cols-3 gap-2">
                {PRICE_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setF((p) => ({ ...p, price_display_mode: m }))}
                    className={`rounded-xl2 border-2 px-2 py-2 text-sm font-bold ${
                      f.price_display_mode === m
                        ? 'border-primary bg-primary text-white'
                        : 'border-sand bg-white text-ink-soft'
                    }`}
                  >
                    {t(`onb.priceMode.${m}`)}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-soft">{t(`onb.priceModeHint.${f.price_display_mode}`)}</p>
            </div>

            <Labeled label={t('onb.prepTime')} hint={t('onb.prepTimeHint')}>
              <select
                className={`${input} appearance-none`}
                value={f.prep_time_minutes}
                onChange={set('prep_time_minutes')}
              >
                {PREP_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {t('onb.prepMins', { n })}
                  </option>
                ))}
              </select>
            </Labeled>

            <label className="flex items-start gap-3 rounded-xl2 border border-sand bg-white px-4 py-3 shadow-card">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                checked={f.auto_confirm}
                onChange={(e) => setF((p) => ({ ...p, auto_confirm: e.target.checked }))}
              />
              <span>
                <span className="block text-sm font-semibold">{t('onb.autoConfirm')}</span>
                <span className="mt-0.5 block text-xs text-ink-soft">{t('onb.autoConfirmHint')}</span>
              </span>
            </label>

            {err && <p className="text-sm font-semibold text-stop">⚠️ {err}</p>}

            <button
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-lg font-semibold text-white disabled:opacity-50"
            >
              {busy ? t('common.loading') : t('onb.create')} <ArrowRight size={18} />
            </button>
          </form>
        </main>
      )}

      {/* ── DONE: QR + poster ───────────────────────────────────────── */}
      {stage === 'done' && shop && (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="flex h-16 w-16 animate-pop-in items-center justify-center rounded-full bg-go/15 text-go">
            <Check size={32} strokeWidth={2.5} />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {t('onb.doneTitle', { name: shop.shop_name })}
          </h1>
          <p className="text-base text-ink-soft">{t('onb.doneSub')}</p>

          <QrImage
            text={shopShareUrl(shop.slug)}
            size={512}
            alt="Shop QR code"
            className="h-56 w-56 rounded-xl2 border-2 border-sand bg-white p-2"
          />
          <code className="break-all rounded-lg bg-sand px-3 py-1.5 text-xs">
            {shopShareUrl(shop.slug)}
          </code>

          <div className="mt-2 w-full space-y-2">
            <Link
              to={`/p/${shop.slug}`}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary py-3 font-semibold text-primary active:bg-primary-tint"
            >
              <Printer size={18} /> {t('onb.openPoster')}
            </Link>
            <button
              onClick={() => navigate('/shop')}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-semibold text-white active:bg-primary-dark"
            >
              <LayoutDashboard size={18} /> {t('onb.goDashboard')}
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
