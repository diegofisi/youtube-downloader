// i18n minimalista sin diccionarios: cada texto lleva su par (es, en) inline.
// El idioma se persiste en localStorage ('stash.lang') y cambiarlo recarga la app.

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'stash.lang';

let cached: Lang | null = null;

export function getLang(): Lang {
  if (cached !== null) return cached;
  let v: string | null = null;
  try {
    v = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* localStorage no disponible: usa el default */
  }
  cached = v === 'en' ? 'en' : 'es';
  return cached;
}

export function setLang(l: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* ignora errores de persistencia */
  }
  cached = l;
  location.reload();
}

export function t(es: string, en: string): string {
  return getLang() === 'en' ? en : es;
}

/**
 * Traduce el HTML estático si el idioma es inglés.
 * - [data-en]       → reemplaza el texto del elemento (si tiene hijos, solo los
 *                     nodos de texto no vacíos, para no destruir iconos SVG).
 * - [data-en-ph]    → reemplaza el placeholder.
 * - [data-en-title] → reemplaza el title (tooltip).
 */
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
