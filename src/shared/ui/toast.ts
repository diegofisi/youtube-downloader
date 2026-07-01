/** Toasts no bloqueantes. Foundation para feedback (se usa desde Fase 1+). */
import { icon } from '../../app/icons';

export type ToastType = 'info' | 'success' | 'error';

const ICON_BY_TYPE: Record<ToastType, string> = {
  info: 'bolt',
  success: 'download',
  error: 'close',
};

export function showToast(message: string, type: ToastType = 'info', ms = 3500): void {
  const host = document.getElementById('toast-host');
  if (!host) return;

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<span class="toast__icon">${icon(ICON_BY_TYPE[type], 16)}</span><span class="toast__msg"></span>`;
  el.querySelector<HTMLElement>('.toast__msg')!.textContent = message;
  host.appendChild(el);

  const remove = () => {
    el.classList.add('toast--out');
    setTimeout(() => el.remove(), 200);
  };
  const timer = setTimeout(remove, ms);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}
