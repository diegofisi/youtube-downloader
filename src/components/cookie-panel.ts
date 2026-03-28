import { checkCookies, loadCookies, openUrl } from '../services/tauri-api';
import { EXTENSION_URLS, type CookieResult } from '../types';

const statusEl = document.getElementById('cookies-status')!;
const loadBtn = document.getElementById('btn-load-cookies')!;

let _hasCookies = false;

export function getCookieMode(): string {
  return _hasCookies ? 'file' : 'none';
}

export function updateCookieStatus(result: CookieResult): void {
  statusEl.className = 'status-badge';

  switch (result.status) {
    case 'youtube':
      statusEl.textContent = 'Cookies de YouTube cargadas correctamente';
      statusEl.classList.add('status-success');
      _hasCookies = true;
      break;
    case 'generic':
      statusEl.textContent = 'Cookies cargadas (sin cookies de YouTube detectadas)';
      statusEl.classList.add('status-warning');
      _hasCookies = true;
      break;
    case 'invalid':
      statusEl.textContent = 'El archivo no parece ser un cookies.txt válido';
      statusEl.classList.add('status-error');
      _hasCookies = false;
      break;
    default:
      statusEl.textContent = 'Sin cookies configuradas';
      statusEl.classList.add('status-error');
      _hasCookies = false;
  }
}

export function initCookiePanel(): void {
  // Browser extension buttons — open extension install page
  document.querySelectorAll<HTMLButtonElement>('[data-browser]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const browser = btn.dataset.browser!;
      openUrl(EXTENSION_URLS[browser]);
    });
  });

  // Load cookies button
  loadBtn.addEventListener('click', async () => {
    const result = await loadCookies();
    if (result.status !== 'cancelled') {
      updateCookieStatus(result);
    }
  });

  // Auto-check on init
  checkCookies().then(updateCookieStatus);
}
