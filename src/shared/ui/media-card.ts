// Grid video card (My YouTube / Search) and empty/loading states. Pure presentational: take a
// minimal structural type (VideoMeta fits), return HTML; events wire via wireVideoCards() after paint.
import { I } from './icons';
import { CARD_GRAD } from './gradients';
import { esc } from '../lib/html';
import { fmtDuration } from '../lib/format';
import { t } from '../../core/i18n';

/** Minimum fields the card needs (structural: VideoMeta satisfies it). */
export interface CardMedia {
  url: string;
  title: string;
  channel: string;
  thumbnail?: string;
  duration?: number;
}

/** Selection checkbox overlay (top-left corner of the card). */
function checkOverlay(on: boolean): string {
  return `<button class="mc-check" style="position:absolute;top:8px;left:8px;width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;border:1.8px solid ${
    on ? 'var(--accent)' : 'rgba(255,255,255,.7)'
  };background:${on ? 'var(--accent)' : 'rgba(0,0,0,.4)'};color:#fff;backdrop-filter:blur(4px)">${on ? I.check : ''}</button>`;
}

/** Grid video card: thumbnail (CARD_GRAD background while loading), duration
 * badge, selection checkbox, ⬇ button, 2-line title and channel. */
export function videoCard(v: CardMedia, selected: boolean): string {
  const thumbInner = v.thumbnail
    ? `<img src="${esc(v.thumbnail)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" alt="">`
    : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.85">${I.play20}</div>`;
  return `<div data-url="${esc(v.url)}" style="background:var(--panel);border:1px solid ${
    selected ? 'var(--accent)' : 'var(--border)'
  };border-radius:13px;overflow:hidden">
    <div style="position:relative;aspect-ratio:16/9;background:${CARD_GRAD}">
      ${thumbInner}
      ${checkOverlay(selected)}
      <button class="mc-dl" title="${t('Descargar', 'Download')}" style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:8px;background:rgba(0,0,0,.6);color:#fff;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">${I.download}</button>
      ${v.duration ? `<span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.78);color:#fff;font-size:10.5px;font-weight:600;padding:1.5px 5px;border-radius:5px;font-family:'JetBrains Mono',monospace">${fmtDuration(v.duration)}</span>` : ''}
    </div>
    <div style="padding:10px 11px 12px">
      <div style="font-weight:600;font-size:12.5px;line-height:1.35;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:34px">${esc(v.title)}</div>
      <div style="font-size:11.5px;color:var(--text2);margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.channel)}</div>
    </div>
  </div>`;
}

/** Wires the checkbox and ⬇ button of the cards already painted in `list`.
 * `toggle` gets the card url; `download` gets the anchor button and the item. */
export function wireVideoCards<T extends CardMedia>(
  list: HTMLElement,
  items: T[],
  on: { toggle: (url: string) => void; download: (anchor: HTMLElement, item: T) => void },
): void {
  list.querySelectorAll<HTMLElement>('[data-url]').forEach((card) => {
    const url = card.dataset.url!;
    const item = items.find((x) => x.url === url)!;
    card.querySelector('.mc-check')?.addEventListener('click', (e) => {
      e.stopPropagation();
      on.toggle(url);
    });
    card.querySelector('.mc-dl')?.addEventListener('click', (e) => {
      e.stopPropagation();
      on.download(e.currentTarget as HTMLElement, item);
    });
  });
}

/** Grid empty/error state (title + message). Optional `actionHtml` injects a caller-built
 * CTA (e.g. reconnect button); the caller is responsible for escaping and wiring it. */
export function stateCard(title: string, msg: string, actionHtml = ''): string {
  return `<div style="grid-column:1/-1;text-align:center;padding:50px 20px;border:1.5px dashed var(--border2);border-radius:16px;color:var(--text3)">
    <div style="font-size:14px;font-weight:600;color:var(--text2)">${esc(title)}</div>
    <div style="font-size:12.5px;margin-top:5px">${esc(msg)}</div>
    ${actionHtml}
  </div>`;
}

/** Grid loading row (spinner + text). `labelHtml` arrives pre-escaped by the caller. */
export function loadingCard(labelHtml: string): string {
  return `<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:9px;padding:40px;color:var(--text2);font-size:13px">${I.spinner} ${labelHtml}</div>`;
}

/** Filter pill bar (My YouTube tabs, Search chips). Doesn't re-render itself:
 * `onPick` must repaint (and isn't called if the pill was already active). */
export function renderPillBar(
  el: HTMLElement,
  items: readonly { key: string; label: string }[],
  active: string,
  onPick: (key: string) => void,
): void {
  el.innerHTML = items
    .map((it) => {
      const on = active === it.key;
      return `<button data-key="${it.key}" style="padding:7px 14px;border-radius:9px;font-size:12.5px;font-weight:600;border:1.5px solid ${
        on ? 'var(--accent)' : 'var(--border)'
      };background:${on ? 'var(--accentSoft)' : 'transparent'};color:${on ? 'var(--accent)' : 'var(--text2)'}">${it.label}</button>`;
    })
    .join('');
  el.querySelectorAll<HTMLElement>('[data-key]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.key === active) return;
      onPick(b.dataset.key!);
    }),
  );
}
