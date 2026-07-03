// Minimal dictionary-less i18n: every text carries its (es, en) pair inline.
// Unlike the vanilla app, changing the language re-renders live (no reload):
// the ui store updates this cache and the app root remounts via key={lang}.

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'stash.lang';

let cached: Lang | null = null;

export function getInitialLang(): Lang {
  if (cached !== null) return cached;
  let v: string | null = null;
  try {
    v = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* localStorage unavailable: use the default */
  }
  cached = v === 'en' ? 'en' : 'es';
  return cached;
}

/** Updates the module cache + persistence. Re-render is the ui store's job. */
export function persistLang(l: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* ignore persistence errors */
  }
  cached = l;
}

export function t(es: string, en: string): string {
  return getInitialLang() === 'en' ? en : es;
}
