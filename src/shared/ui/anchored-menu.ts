import { esc } from '../lib/html';

/** Anchored-menu item: optional icon, label and on-pick action. */
export interface AnchoredMenuItem {
  icon?: string;
  label: string;
  /** Text color (and icon, by inheritance). Defaults to var(--text) with var(--text2) icon. */
  color?: string;
  onPick: () => void;
}

/** Open menu (only one at a time) and its anchor button. */
let menu: HTMLElement | null = null;
let menuAnchor: HTMLElement | null = null;

/** Closes the open anchored menu (if any). Useful in render() calls that repaint the grid. */
export function closeAnchoredMenu(): void {
  menu?.remove();
  menu = null;
  menuAnchor = null;
}

/** Opens a dropdown anchored to `anchor`'s rect: right-aligned, below the button (above if it
 * doesn't fit), viewport-clamped. Same-anchor click toggles; outside click / Escape / pick close. */
export function openAnchoredMenu(anchor: HTMLElement, items: AnchoredMenuItem[]): void {
  if (menuAnchor === anchor) {
    closeAnchoredMenu(); // second click on the same button: close
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
      it.icon
        ? `<span style="display:flex;flex:none;color:${it.color ? 'currentColor' : 'var(--text2)'}">${it.icon}</span>`
        : ''
    }${esc(it.label)}`;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAnchoredMenu();
      it.onPick();
    });
    el.appendChild(b);
  }
  document.body.appendChild(el);
  // Position below the button, aligned to its right edge; above if it doesn't
  // fit; always inside the viewport (8px margin).
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

// Global listeners registered ONCE at module level: outside click and Escape.
// Clicks on the anchor are ignored here so the open-click (bubbling to document)
// never closes the menu it just opened; the anchor handles its own toggle.
document.addEventListener('click', (e) => {
  const target = e.target as Node;
  if (menu && !menu.contains(target) && !menuAnchor?.contains(target)) closeAnchoredMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu) closeAnchoredMenu();
});
// The menu is position:fixed: any scroll/resize would leave it floating detached
// from its anchor, so it closes (capture catches inner-container scrolls).
document.addEventListener('scroll', () => closeAnchoredMenu(), true);
window.addEventListener('resize', () => closeAnchoredMenu());
