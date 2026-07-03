/** Stash theme: applies the full palette as CSS vars on <html>. Violet accent. */
export type Theme = 'dark' | 'light';
const KEY = 'stash-theme';

type Vars = Record<string, string>;

const THEMES: Record<Theme, Vars> = {
  dark: {
    '--bg': '#19191B',
    '--bg2': '#252527',
    '--side': '#1F1F21',
    '--panel': '#2A2A2D',
    '--panel2': '#323235',
    '--hover': 'rgba(255,255,255,.06)',
    '--border': 'rgba(255,255,255,.09)',
    '--border2': 'rgba(255,255,255,.15)',
    '--text': '#F5F5F7',
    '--text2': '#A1A1A6',
    '--text3': '#6E6E73',
    '--accent': '#7C6BF0',
    '--accentText': '#FFFFFF',
    '--accentSoft': 'rgba(124,107,240,.16)',
    '--success': '#36D399',
    '--successSoft': 'rgba(54,211,153,.15)',
    '--warn': '#F7B955',
    '--warnSoft': 'rgba(247,185,85,.16)',
    '--danger': '#FF5C6E',
    '--dangerSoft': 'rgba(255,92,110,.15)',
    '--info': '#5AA2FF',
    '--infoSoft': 'rgba(90,162,255,.15)',
    '--shadow': '0 14px 40px rgba(0,0,0,.5)',
  },
  light: {
    '--bg': '#F2F2F4',
    '--bg2': '#E9E9EC',
    '--side': '#E7E7EA',
    '--panel': '#FFFFFF',
    '--panel2': '#FAFAFB',
    '--hover': 'rgba(0,0,0,.05)',
    '--border': 'rgba(0,0,0,.10)',
    '--border2': 'rgba(0,0,0,.15)',
    '--text': '#1D1D1F',
    '--text2': '#6E6E73',
    '--text3': '#A1A1A6',
    '--accent': '#6A56E0',
    '--accentText': '#FFFFFF',
    '--accentSoft': 'rgba(124,107,240,.14)',
    '--success': '#1FA463',
    '--successSoft': 'rgba(31,164,99,.13)',
    '--warn': '#B5790B',
    '--warnSoft': 'rgba(206,150,30,.15)',
    '--danger': '#E0394F',
    '--dangerSoft': 'rgba(224,57,79,.11)',
    '--info': '#2D7BE0',
    '--infoSoft': 'rgba(45,123,224,.11)',
    '--shadow': '0 8px 24px rgba(0,0,0,.12)',
  },
};

export function getTheme(): Theme {
  // Validates the stored value: a corrupted entry must not leak out as Theme.
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const vars = THEMES[theme];
  for (const k in vars) root.style.setProperty(k, vars[k]);
  root.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore persistence errors */
  }
}
