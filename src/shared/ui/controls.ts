import { $ } from './dom';

/** Chip with accent border when active. `pad` enables the compact Settings variant (5px 11px). */
const chipStyle = (on: boolean, pad = '6px 11px'): string =>
  `padding:${pad};border-radius:8px;font-size:12px;font-weight:600;border:1.5px solid ${
    on ? 'var(--accent)' : 'var(--border)'
  };background:${on ? 'var(--accentSoft)' : 'transparent'};color:${on ? 'var(--accent)' : 'var(--text2)'}`;

/** Button of a segmented group (Settings style: raised piece when active). */
const segStyle = (on: boolean): string =>
  `padding:6px 15px;border-radius:7px;font-size:12.5px;font-weight:600;${
    on
      ? 'background:var(--panel);color:var(--text);box-shadow:0 1px 4px rgba(0,0,0,.25)'
      : 'color:var(--text2);background:transparent'
  }`;

/** Track of the on/off toggle. */
export const toggleStyle = (on: boolean): string =>
  `width:38px;height:22px;flex:none;border-radius:12px;padding:2px;display:flex;background:${
    on ? 'var(--accent)' : 'var(--border2)'
  };justify-content:${on ? 'flex-end' : 'flex-start'};transition:all .18s`;

/** White knob of the toggle. */
export const knob =
  '<span style="width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>';

export interface ChipGroupOpts {
  /** Chip padding (compact Settings variant: '5px 11px'). */
  pad?: string;
  /** false: don't re-render the group on pick (the caller repaints everything, e.g. modals). */
  rerender?: boolean;
  /** Runs after the re-render triggered by each click. */
  after?: () => void;
}

/** Paints a chip group into the `[data-group="…"]` container. The picked value comes from `list`
 * by index (same order as the innerHTML) to keep the literal type T without casting dataset.val. */
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

/** Paints a segmented group into element `id`; repaints on pick. */
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

/** Paints an on/off toggle into element `id`; flips on click. */
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
