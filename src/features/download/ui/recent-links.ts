import { esc } from '../../../shared/lib/html';
import { t } from '../../../core/i18n';
import { $ } from '../../../shared/ui/dom';
import { timeAgo } from '../../../shared/lib/format';

// ---------- historial de enlaces recientes (localStorage) ----------
// Nota: no usa shared/ui/anchored-menu a propósito — ese helper crea un menú
// flotante genérico de items icono+etiqueta, mientras que este panel es un
// elemento fijo del layout (#recent-panel) con filas ricas (url en mono +
// timeAgo + pie "Limpiar recientes") y cierre coordinado con el modal.

const RECENT_KEY = 'stash.recentLinks';
interface RecentLink {
  url: string;
  ts: number;
}
function loadRecents(): RecentLink[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (Array.isArray(raw))
      return (raw as RecentLink[]).filter((r) => r && typeof r.url === 'string' && typeof r.ts === 'number');
  } catch {
    /* dato corrupto: se ignora */
  }
  return [];
}
export function addRecentLinks(urls: string[]): void {
  const now = Date.now();
  const merged = [...urls.map((u) => ({ url: u, ts: now })), ...loadRecents()];
  const seen = new Set<string>();
  const out = merged.filter((r) => !seen.has(r.url) && !!seen.add(r.url)).slice(0, 50);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(out));
  } catch {
    /* sin espacio: no es crítico */
  }
}
export function lineCountLabel(n: number): string {
  return t(`${n} línea${n === 1 ? '' : 's'}`, `${n} line${n === 1 ? '' : 's'}`);
}
function renderRecentPanel(): void {
  const panel = $('recent-panel');
  const items = loadRecents();
  if (items.length === 0) {
    panel.innerHTML = `<div style="padding:18px 12px;text-align:center;font-size:12px;color:var(--text3)">${t('Sin enlaces recientes', 'No recent links')}</div>`;
    return;
  }
  const rows = items
    .map(
      (
        r,
      ) => `<button class="rl-item hov" data-url="${esc(r.url)}" title="${esc(r.url)}" style="display:flex;align-items:center;gap:8px;width:100%;padding:7px 9px;border-radius:8px;text-align:left">
      <span style="flex:1;min-width:0;font-size:11.5px;color:var(--text);font-family:'JetBrains Mono',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.url)}</span>
      <span style="flex:none;font-size:10.5px;color:var(--text3)">${timeAgo(r.ts)}</span>
    </button>`,
    )
    .join('');
  panel.innerHTML = `<div style="display:flex;flex-direction:column">${rows}</div>
    <div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">
      <button id="rl-clear" class="hov" style="width:100%;padding:7px;border-radius:8px;font-size:11.5px;font-weight:600;color:var(--danger)">${t('Limpiar recientes', 'Clear recents')}</button>
    </div>`;
  panel.querySelectorAll<HTMLElement>('.rl-item').forEach((b) =>
    b.addEventListener('click', () => {
      // Añade el enlace al textarea sin duplicar líneas y actualiza el contador.
      const input = $<HTMLTextAreaElement>('url-input');
      const lines = input.value
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.includes(b.dataset.url!)) lines.push(b.dataset.url!);
      input.value = lines.join('\n');
      $('link-count').textContent = lineCountLabel(lines.length);
    }),
  );
  panel.querySelector('#rl-clear')?.addEventListener('click', () => {
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* ignorar */
    }
    renderRecentPanel();
  });
}

/** ¿Está visible el panel? (para el Escape coordinado en descargar.ts). */
export function isRecentPanelOpen(): boolean {
  return !$('recent-panel').hidden;
}
export function closeRecentPanel(): void {
  $('recent-panel').hidden = true;
}

/**
 * Panel de enlaces recientes: anclado a la cabecera del cuadro de enlaces;
 * se cierra con click fuera o Escape (el Escape lo registra descargar.ts,
 * que da prioridad al modal por-video si está abierto).
 */
export function initRecentLinks(): void {
  const recentPanel = $('recent-panel');
  $('btn-recents').addEventListener('click', (e) => {
    e.stopPropagation();
    if (recentPanel.hidden) {
      renderRecentPanel();
      recentPanel.hidden = false;
    } else {
      recentPanel.hidden = true;
    }
  });
  document.addEventListener('click', (e) => {
    if (!recentPanel.hidden && !recentPanel.contains(e.target as Node)) recentPanel.hidden = true;
  });
}
