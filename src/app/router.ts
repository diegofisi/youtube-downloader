/**
 * Router de secciones (client-side, sin history server).
 * Muestra una `.view[data-view]` a la vez y marca el nav-item activo.
 */
import { bus } from '../core/bus/event-bus';

export type ViewId = 'descargar' | 'cola' | 'youtube' | 'biblioteca' | 'ajustes';

const TITLES: Record<ViewId, string> = {
  descargar: 'Descargar',
  cola: 'Cola de descargas',
  youtube: 'Mi YouTube',
  biblioteca: 'Biblioteca',
  ajustes: 'Ajustes',
};

let current: ViewId | null = null;

export const router: { navigate: (v: ViewId) => void } = {
  navigate: () => {},
};

export function initRouter(sectionTitleEl: HTMLElement): void {
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav as ViewId));
  });

  function navigate(view: ViewId): void {
    if (!TITLES[view] || view === current) return;
    current = view;

    document.querySelectorAll<HTMLElement>('.view').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.view === view);
    });
    document.querySelectorAll<HTMLElement>('[data-nav]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.nav === view);
    });
    sectionTitleEl.textContent = TITLES[view];
    bus.emit('nav:changed', { view });
  }

  // Exponer para navegación programática
  router.navigate = navigate;
  navigate('descargar');
}
