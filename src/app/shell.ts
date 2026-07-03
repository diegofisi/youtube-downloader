import { I } from '../shared/ui/icons';
import { getTheme, applyTheme } from '../core/theme';
import { bus } from '../core/bus/event-bus';
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from '../core/tauri/window';
import { openYouTubeLogin } from '../features/session';
import { showToast } from '../shared/ui/toast';
import { t } from '../core/i18n';

export type ViewId = 'descargar' | 'buscar' | 'youtube' | 'cola' | 'biblioteca' | 'ajustes';

const TITLES: Record<ViewId, string> = {
  descargar: t('Descargar', 'Download'),
  buscar: t('Buscar', 'Search'),
  youtube: t('Mi YouTube', 'My YouTube'),
  cola: t('Cola de descargas', 'Download queue'),
  biblioteca: t('Biblioteca', 'Library'),
  ajustes: t('Ajustes', 'Settings'),
};

/** Magnifier at 18px (I.search is 16px; nav icons are 18). */
const searchNavIcon =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.9"/><path d="m20 20-3.2-3.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

const NAV: { id: ViewId; label: string; icon: string; badge?: boolean }[] = [
  { id: 'descargar', label: t('Descargar', 'Download'), icon: I.download },
  { id: 'buscar', label: t('Buscar', 'Search'), icon: searchNavIcon },
  { id: 'youtube', label: t('Mi YouTube', 'My YouTube'), icon: I.youtube },
  { id: 'cola', label: t('Cola', 'Queue'), icon: I.queue, badge: true },
  { id: 'biblioteca', label: t('Biblioteca', 'Library'), icon: I.library },
  { id: 'ajustes', label: t('Ajustes', 'Settings'), icon: I.settings },
];

let current: ViewId = 'descargar';
export const router = { navigate: (_v: ViewId) => {}, setBadge: (_n: number) => {} };

function navStyle(id: ViewId): string {
  const on = current === id;
  return `display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:10px;width:100%;font-size:13.5px;font-weight:500;text-align:left;${
    on ? 'background:var(--accentSoft);color:var(--accent)' : 'color:var(--text2)'
  }`;
}

export function initShell(): void {
  applyTheme(getTheme());

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle')!;
  const renderTheme = () => (themeBtn.innerHTML = getTheme() === 'dark' ? I.sun : I.moon);
  renderTheme();
  themeBtn.addEventListener('click', () => {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
    bus.emit('theme:changed');
  });
  // Repaints the icon when the theme changes from anywhere (e.g. Settings).
  // Only listens and repaints: never re-emits, so no loop.
  bus.on('theme:changed', renderTheme);

  // Window controls (2 sets: traffic lights + buttons)
  const wire = (ids: string[], fn: () => void) =>
    ids.forEach((id) => document.getElementById(id)?.addEventListener('click', fn));
  wire(['win-close', 'win-close-2'], () => void closeWindow());
  wire(['win-min', 'win-min-2'], () => void minimizeWindow());
  wire(['win-max', 'win-max-2'], () => void toggleMaximizeWindow());

  // Sidebar nav
  const navEl = document.getElementById('nav')!;
  const render = () => {
    navEl.innerHTML = NAV.map(
      (n) => `
      <button class="nav-btn" data-nav="${n.id}" style="${navStyle(n.id)}">
        <span style="display:flex;width:18px;height:18px">${n.icon}</span>
        <span style="flex:1">${n.label}</span>
        ${
          n.badge
            ? `<span class="nav-badge" data-badge="${n.id}" hidden style="background:var(--accent);color:var(--accentText);font-size:10.5px;font-weight:700;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:9px;padding:0 5px;font-family:'JetBrains Mono',monospace"></span>`
            : ''
        }
      </button>`,
    ).join('');
    navEl.querySelectorAll<HTMLElement>('.nav-btn').forEach((b) => {
      b.addEventListener('click', () => navigate(b.dataset.nav as ViewId));
    });
  };
  render();

  function navigate(view: ViewId): void {
    if (!TITLES[view]) return;
    current = view;
    document
      .querySelectorAll<HTMLElement>('.view')
      .forEach((el) => el.classList.toggle('is-active', el.dataset.view === view));
    document.getElementById('section-title')!.textContent = TITLES[view];
    navEl.querySelectorAll<HTMLElement>('.nav-btn').forEach((b) => {
      b.setAttribute('style', navStyle(b.dataset.nav as ViewId));
    });
    bus.emit('nav:changed', { view });
  }
  router.navigate = navigate;
  router.setBadge = (n: number) => {
    const badge = document.querySelector<HTMLElement>('[data-badge="cola"]');
    if (!badge) return;
    badge.hidden = n <= 0;
    badge.textContent = String(n);
  };
  bus.on('nav:goto', ({ view }) => navigate(view as ViewId));
  bus.on('queue:count', ({ active }) => router.setBadge(active));

  // Session banner: appears when the YouTube session expires
  let bannerDismissed = false;
  bus.on('session:expired', () => {
    if (!bannerDismissed) document.getElementById('session-banner')!.hidden = false;
  });
  bus.on('session:connected', () => {
    document.getElementById('session-banner')!.hidden = true;
    bannerDismissed = false;
  });
  document.getElementById('banner-dismiss')?.addEventListener('click', () => {
    bannerDismissed = true;
    document.getElementById('session-banner')!.hidden = true;
  });
  document.getElementById('banner-reconnect')?.addEventListener('click', () => {
    document.getElementById('session-banner')!.hidden = true;
    navigate('youtube');
    openYouTubeLogin().catch(() => showToast(t('No se pudo abrir el login', 'Could not open login'), '', 'error'));
  });

  navigate('descargar');
}
