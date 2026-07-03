// Minimal dictionary-less i18n: every text carries its (es, en) pair inline.
// The language persists in localStorage ('stash.lang'); changing it reloads the app.

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'stash.lang';

let cached: Lang | null = null;

export function getLang(): Lang {
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

export function setLang(l: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* ignore persistence errors */
  }
  cached = l;
  location.reload();
}

export function t(es: string, en: string): string {
  return getLang() === 'en' ? en : es;
}

/** Translates static HTML when the language is English: [data-en] replaces element text (only
 * non-empty text nodes, to keep SVG icons), [data-en-ph] the placeholder, [data-en-title] the title. */
export function applyStaticI18n(): void {
  if (getLang() !== 'en') return;
  document.documentElement.lang = 'en';

  document.querySelectorAll<HTMLElement>('[data-en]').forEach((el) => {
    const en = el.dataset.en;
    if (en === undefined) return;
    if (el.children.length > 0) {
      el.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim() !== '') {
          node.textContent = en;
        }
      });
    } else {
      el.textContent = en;
    }
  });

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-en-ph]').forEach((el) => {
    const ph = el.dataset.enPh;
    if (ph !== undefined) el.placeholder = ph;
  });

  document.querySelectorAll<HTMLElement>('[data-en-title]').forEach((el) => {
    const title = el.dataset.enTitle;
    if (title !== undefined) el.title = title;
  });
}
