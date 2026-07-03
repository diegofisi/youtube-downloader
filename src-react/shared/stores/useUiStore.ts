import { create } from 'zustand';
import { getInitialLang, persistLang, type Lang } from '@/shared/lib/i18n';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'stash-theme'; // legacy key shared with the vanilla app

interface UiStore {
  // State
  lang: Lang;
  theme: Theme;
  // Actions
  setLang: (l: Lang) => void;
  setTheme: (theme: Theme) => void;
}

const getInitialTheme = (): Theme => {
  // Validates the stored value: a corrupted entry must not leak out as Theme.
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

/** Toggles the Tailwind dark class + data-theme attr and persists the choice. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore persistence errors */
  }
}

export const useUiStore = create<UiStore>((set) => ({
  lang: getInitialLang(),
  theme: getInitialTheme(),
  setLang: (lang) => {
    persistLang(lang); // updates the t() cache; key={lang} re-renders the app
    set({ lang });
  },
  setTheme: (theme) => {
    applyTheme(theme); // CSS vars restyle without re-render
    set({ theme });
  },
}));
