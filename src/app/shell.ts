/** Monta el chrome del shell: iconos del sidebar, titlebar, tema y controles de ventana. */
import { icon } from './icons';
import { initThemeToggle } from './theme';
import { initRouter } from './router';
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from '../core/tauri/window';

export function initShell(): void {
  // Iconos del sidebar (data-icon)
  document.querySelectorAll<HTMLElement>('.nav-item__icon[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon!, 18);
  });
  // Logo de la titlebar
  const logo = document.querySelector<HTMLElement>('.titlebar__logo');
  if (logo) logo.innerHTML = icon('bolt', 14);

  // Controles de ventana
  const mount = (sel: string, svg: string, fn: () => void) => {
    const btn = document.querySelector<HTMLElement>(sel);
    if (!btn) return;
    btn.innerHTML = icon(svg, 15);
    btn.addEventListener('click', fn);
  };
  mount('#win-min', 'min', () => void minimizeWindow());
  mount('#win-max', 'max', () => void toggleMaximizeWindow());
  mount('#win-close', 'close', () => void closeWindow());

  // Tema
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) initThemeToggle(themeBtn);

  // Router
  const sectionTitle = document.getElementById('titlebar-section')!;
  initRouter(sectionTitle);
}
