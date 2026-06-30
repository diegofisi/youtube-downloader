import { checkCookies, loadCookies, openUrl, openYouTubeLogin, onCookiesExtracted } from '../services/tauri-api';
import { EXTENSION_URLS, type CookieResult } from '../types';

const statusEl = document.getElementById('cookies-status')!;
const loadBtn = document.getElementById('btn-load-cookies')!;
const loginBtn = document.getElementById('btn-youtube-login')!;

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
  // Browser extension buttons
  document.querySelectorAll<HTMLButtonElement>('[data-browser]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const browser = btn.dataset.browser!;
      openUrl(EXTENSION_URLS[browser]);
    });
  });

  // Load cookies from file
  loadBtn.addEventListener('click', async () => {
    const result = await loadCookies();
    if (result.status !== 'cancelled') {
      updateCookieStatus(result);
    }
  });

  // YouTube WebView login button
  loginBtn.addEventListener('click', async () => {
    loginBtn.textContent = 'Abriendo YouTube...';
    (loginBtn as HTMLButtonElement).disabled = true;
    try {
      await openYouTubeLogin();
    } catch (e) {
      console.error('Error opening login:', e);
      loginBtn.textContent = 'Iniciar sesion en YouTube';
      (loginBtn as HTMLButtonElement).disabled = false;
    }
  });

  // Listen for cookies extracted from WebView
  onCookiesExtracted((success) => {
    loginBtn.textContent = 'Iniciar sesion en YouTube';
    (loginBtn as HTMLButtonElement).disabled = false;
    if (success) {
      // Re-check cookies to update status
      checkCookies().then(updateCookieStatus);
    }
  });

  // Auto-check on init
  checkCookies().then(updateCookieStatus);
}
