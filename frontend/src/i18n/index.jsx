import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import en from './en.json';
import ta from './ta.json';

const DICTS = { en, ta };
const STORAGE_KEY = 'p31.lang';

const I18nContext = createContext(null);

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'ta') return saved;
    } catch {
      /* private mode / disabled storage */
    }
    return navigator.language?.startsWith('ta') ? 'ta' : 'en';
  });

  const changeLang = useCallback((next) => {
    setLang(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key, vars) => {
      const dict = DICTS[lang] || DICTS.en;
      return interpolate(dict[key] ?? DICTS.en[key] ?? key, vars);
    },
    [lang],
  );

  const value = useMemo(
    () => ({ lang, t, changeLang, other: lang === 'en' ? 'ta' : 'en' }),
    [lang, t, changeLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
