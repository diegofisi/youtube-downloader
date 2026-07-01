/** Tema: fuente de verdad = [data-theme] en <html>, persistido en localStorage. */
export type Theme = 'dark' | 'light';
const KEY = 'stash-theme';

export function getTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme) || 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEY, theme);
}
