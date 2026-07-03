import { $ } from './dom';

/** Chip con borde de acento cuando está activo. `pad` permite la variante compacta de Ajustes (5px 11px). */
export const chipStyle = (on: boolean, pad = '6px 11px'): string =>
  `padding:${pad};border-radius:8px;font-size:12px;font-weight:600;border:1.5px solid ${
    on ? 'var(--accent)' : 'var(--border)'
  };background:${on ? 'var(--accentSoft)' : 'transparent'};color:${on ? 'var(--accent)' : 'var(--text2)'}`;

/** Botón de un grupo segmentado (estilo Ajustes: pieza elevada cuando está activa). */
export const segStyle = (on: boolean): string =>
  `padding:6px 15px;border-radius:7px;font-size:12.5px;font-weight:600;${
    on
      ? 'background:var(--panel);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.25)'
      : 'color:var(--text2);background:transparent'
  }`;

/** Pista del interruptor on/off. */
export const toggleStyle = (on: boolean): string =>
  `width:38px;height:22px;flex:none;border-radius:12px;padding:2px;display:flex;background:${
    on ? 'var(--accent)' : 'var(--border2)'
  };justify-content:${on ? 'flex-end' : 'flex-start'};transition:all .18s`;

/** Bolita blanca del interruptor. */
export const knob =
  '<span style="width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>';

export interface ChipGroupOpts {
  /** Padding del chip (variante compacta de Ajustes: '5px 11px'). */
  pad?: string;
  /** false: no re-renderizar el grupo al elegir (el llamador repinta todo, p. ej. modales). */
  rerender?: boolean;
  /** Se ejecuta tras el re-render provocado por cada click. */
  after?: () => void;
}

/**
 * Pinta un grupo de chips en el contenedor `[data-group="…"]`. El valor elegido
 * se toma de `list` por índice (mismo orden que el innerHTML) para conservar el
 * tipo literal T sin castear dataset.val (que siempre es string).
 */
export function renderChipGroup<T extends string>(
  groupSel: string,
  list: [T, string][],
  get: () => string,
  onPick: (v: T) => void,
  o?: ChipGroupOpts,
): void {
  const el = document.querySelector<HTMLElement>(`[data-group="${groupSel}"]`);
  if (!el) return;
  el.innerHTML = list
    .map(([v, l]) => `<button data-val="${v}" style="${chipStyle(v === get(), o?.pad)}">${l}</button>`)
    .join('');
  el.querySelectorAll<HTMLElement>('[data-val]').forEach((b, i) =>
    b.addEventListener('click', () => {
      onPick(list[i][0]);
      if (o?.rerender !== false) renderChipGroup(groupSel, list, get, onPick, o);
      o?.after?.();
    }),
  );
}

/** Pinta un grupo segmentado en el elemento con id `id` y se re-pinta al elegir. */
export function renderSeg(id: string, list: [string, string][], get: () => string, set: (v: string) => void): void {
  const el = $(id);
  el.innerHTML = list
    .map(([v, l]) => `<button data-val="${v}" style="${segStyle(v === get())}">${l}</button>`)
    .join('');
  el.querySelectorAll<HTMLElement>('[data-val]').forEach((b) =>
    b.addEventListener('click', () => {
      set(b.dataset.val!);
      renderSeg(id, list, get, set);
    }),
  );
}

/** Pinta un interruptor on/off en el elemento con id `id` y alterna al click. */
export function renderToggle(id: string, get: () => boolean, set: (v: boolean) => void): void {
  const btn = $(id);
  const paint = () => {
    btn.setAttribute('style', toggleStyle(get()));
    btn.innerHTML = knob;
    btn.dataset.on = get() ? '1' : '0';
  };
  paint();
  btn.addEventListener('click', () => {
    set(!get());
    paint();
  });
}
