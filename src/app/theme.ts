/** Tema claro/oscuro: fuente de verdad = [data-theme] en <html>, persistido. */
import { icon } from './icons';

export type Theme = 'dark' | 'light';
const KEY = 'stash-theme';

export function getTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme) || 'dark';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(KEY, theme);
}

/** Conecta el botón de toggle de la titlebar. */
export function initThemeToggle(btn: HTMLElement): void {
  const render = () => {
    const t = getTheme();
    btn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon', 17);
    btn.title = t === 'dark' ? 'Tema claro' : 'Tema oscuro';
  };
  applyTheme(getTheme());
  render();
  btn.addEventListener('click', () => {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
    render();
  });
}
