import { esc } from '../lib/html';

/** Item de un menú anclado: icono opcional, etiqueta y acción al elegir. */
export interface AnchoredMenuItem {
  icon?: string;
  label: string;
  /** Color del texto (y del icono, por herencia). Por defecto var(--text) con icono var(--text2). */
  color?: string;
  onPick: () => void;
}

/** Menú abierto (solo uno a la vez) y su botón ancla. */
let menu: HTMLElement | null = null;
let menuAnchor: HTMLElement | null = null;

/** Cierra el menú anclado abierto (si lo hay). Útil en los render() que repintan el grid. */
export function closeAnchoredMenu(): void {
  menu?.remove();
  menu = null;
  menuAnchor = null;
}

/**
 * Abre un menú desplegable anclado al rect de `anchor`: alineado a su borde
 * derecho, bajo el botón (encima si no cabe) y con clamp al viewport. Un
 * segundo click en el mismo ancla lo cierra (toggle). Se cierra con click
 * fuera, Escape o al elegir un item.
 */
export function openAnchoredMenu(anchor: HTMLElement, items: AnchoredMenuItem[]): void {
  if (menuAnchor === anchor) {
    closeAnchoredMenu(); // segundo click en el mismo botón: cerrar
    return;
  }
  closeAnchoredMenu();
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;z-index:900;min-width:200px;padding:4px;background:var(--panel);border:1px solid var(--border);border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:2px';
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'hov';
    b.style.cssText = `display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;border-radius:7px;font-size:12.5px;font-weight:600;color:${
      it.color ?? 'var(--text)'
    };text-align:left`;
    b.innerHTML = `${
      it.icon ? `<span style="display:flex;flex:none;color:${it.color ? 'currentColor' : 'var(--text2)'}">${it.icon}</span>` : ''
    }${esc(it.label)}`;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAnchoredMenu();
      it.onPick();
    });
    el.appendChild(b);
  }
  document.body.appendChild(el);
  // Posicionar bajo el botón, alineado a su borde derecho; si no cabe, encima;
  // siempre dentro del viewport (margen de 8px).
  const r = anchor.getBoundingClientRect();
  const mw = el.offsetWidth;
  const mh = el.offsetHeight;
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  el.style.top = `${top}px`;
  el.style.left = `${Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8))}px`;
  menu = el;
  menuAnchor = anchor;
}

// Listeners globales registrados UNA sola vez a nivel de módulo: click fuera y Escape.
document.addEventListener('click', (e) => {
  if (menu && !menu.contains(e.target as Node)) closeAnchoredMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu) closeAnchoredMenu();
});
