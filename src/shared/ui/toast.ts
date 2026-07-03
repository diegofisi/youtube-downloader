import { I } from './icons';
import { esc } from '../lib/html';

export type ToastKind = 'done' | 'warn' | 'info' | 'error';

// Static info icon (the spinner spun forever and looked like "loading").
const INFO_ICON =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.9"/><path d="M12 11v5.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor"/></svg>';

const MAP: Record<ToastKind, { bg: string; c: string; ic: string }> = {
  done: { bg: 'var(--successSoft)', c: 'var(--success)', ic: I.check },
  warn: { bg: 'var(--warnSoft)', c: 'var(--warn)', ic: I.alert },
  info: { bg: 'var(--infoSoft)', c: 'var(--info)', ic: INFO_ICON },
  error: { bg: 'var(--dangerSoft)', c: 'var(--danger)', ic: I.alert },
};

export function showToast(title: string, body = '', kind: ToastKind = 'done', ms = 4200): void {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const m = MAP[kind];
  const el = document.createElement('div');
  el.style.cssText =
    'display:flex;align-items:flex-start;gap:11px;padding:13px 14px;background:var(--panel2);border:1px solid var(--border2);border-radius:13px;box-shadow:0 12px 34px rgba(0,0,0,.5);animation:toastin .28s ease';
  el.innerHTML = `
    <span style="width:26px;height:26px;flex:none;border-radius:8px;display:flex;align-items:center;justify-content:center;background:${m.bg};color:${m.c}">${m.ic}</span>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:13px">${esc(title)}</div>
      ${body ? `<div style="font-size:12px;color:var(--text2);margin-top:1px">${esc(body)}</div>` : ''}
    </div>
    <button class="t-x" style="color:var(--text3);padding:2px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>`;
  host.appendChild(el);
  const remove = () => el.remove();
  el.querySelector('.t-x')!.addEventListener('click', remove);
  setTimeout(remove, ms);
  while (host.children.length > 3) host.removeChild(host.firstChild!);
}
