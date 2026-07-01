/** Toggle de tema en la titlebar (usa los helpers de core/theme). */
import { icon } from './icons';
import { getTheme, applyTheme } from '../core/theme';

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
