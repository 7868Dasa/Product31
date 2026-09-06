import { useI18n } from '../i18n/index.jsx';

export function LangToggle() {
  const { t, changeLang, other } = useI18n();
  return (
    <button
      onClick={() => changeLang(other)}
      className="rounded-full border-2 border-sand bg-white px-4 py-2 text-base font-semibold text-ink-soft active:bg-sand"
    >
      🌐 {t('lang.switch')}
    </button>
  );
}
