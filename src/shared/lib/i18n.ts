// i18n engine — call sites use the typed `t` (messages/t.ts), not this.

import type { MessageKey } from './messages/keys';
import { es } from './messages/es';
import { en } from './messages/en';

export type Lang = 'es' | 'en';

const STORAGE_KEY = 'stash.lang';

const CATALOGS: Record<Lang, Record<MessageKey, string>> = { es, en };

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

// Re-render on language change is the ui store's job, not this function's.
export function persistLang(l: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* ignore persistence errors */
  }
  cached = l;
}

export type MessageParams = Record<string, string | number>;

// Minimal ICU: `{name}` interpolation + `{n, plural, =0{} one{} other{}}` with `#`.
function format(tpl: string, params?: MessageParams): string {
  if (!params) return tpl;
  let out = '';
  let i = 0;
  while (i < tpl.length) {
    if (tpl[i] !== '{') {
      out += tpl[i++];
      continue;
    }
    let depth = 1;
    let j = i + 1;
    while (j < tpl.length && depth > 0) {
      if (tpl[j] === '{') depth++;
      else if (tpl[j] === '}') depth--;
      j++;
    }
    const inner = tpl.slice(i + 1, j - 1);
    const plural = /^(\w+),\s*plural,\s*([\s\S]*)$/.exec(inner);
    if (plural) {
      const n = Number(params[plural[1]]);
      const cases: Record<string, string> = {};
      const body = plural[2];
      let k = 0;
      while (k < body.length) {
        const head = /^\s*(=\d+|zero|one|two|few|many|other)\s*\{/.exec(body.slice(k));
        if (!head) break;
        const start = k + head[0].length;
        let d = 1;
        let p = start;
        while (p < body.length && d > 0) {
          if (body[p] === '{') d++;
          else if (body[p] === '}') d--;
          p++;
        }
        cases[head[1]] = body.slice(start, p - 1);
        k = p;
      }
      const chosen = cases[`=${n}`] ?? (n === 1 ? cases.one : cases.other) ?? cases.other ?? '';
      out += format(chosen.replaceAll('#', String(n)), params);
    } else if (inner in params) {
      out += String(params[inner]);
    } else {
      out += `{${inner}}`;
    }
    i = j;
  }
  return out;
}

// Low-level engine — call sites should prefer the typed `t` object (messages/t.ts).
export function translate(key: MessageKey, params?: MessageParams): string {
  const lang = getInitialLang();
  const tpl = CATALOGS[lang][key] ?? CATALOGS.es[key];
  return format(tpl, params);
}
