import {
  checkCookies,
  loadCookies,
  openUrl,
  openYouTubeLogin,
  onCookiesExtracted,
} from '../session.api';
import { EXTENSION_URLS, type CookieResult } from '../session.types';
import { showToast } from '../../../shared/ui/toast';

const statusEl = document.getElementById('cookies-status')!;
const loadBtn = document.getElementById('btn-load-cookies')!;
const loginBtn = document.getElementById('btn-youtube-login') as HTMLButtonElement;

const LOGIN_LABEL = 'Iniciar sesion en YouTube';
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

function resetLoginButton(): void {
  loginBtn.disabled = false;
  // Mantener el SVG del logo, solo restaurar el texto del nodo final.
  loginBtn.lastChild!.textContent = ` ${LOGIN_LABEL}`;
}

export function initCookiePanel(): void {
  // Botones de extensiones por navegador
  document.querySelectorAll<HTMLButtonElement>('[data-browser]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const browser = btn.dataset.browser!;
      openUrl(EXTENSION_URLS[browser]);
    });
  });

  // Cargar cookies desde archivo
  loadBtn.addEventListener('click', async () => {
    const result = await loadCookies();
    if (result.status !== 'cancelled') {
      updateCookieStatus(result);
    }
  });

  // Login por WebView de YouTube
  loginBtn.addEventListener('click', async () => {
    loginBtn.disabled = true;
    loginBtn.lastChild!.textContent = ' Abriendo YouTube...';
    try {
      await openYouTubeLogin();
      // FIX login colgado: rehabilitar el botón tras abrir la ventana, así nunca
      // queda bloqueado si el usuario cierra el login sin completar.
      loginBtn.disabled = false;
      loginBtn.lastChild!.textContent = ' Esperando inicio de sesion...';
    } catch (e) {
      console.error('Error opening login:', e);
      resetLoginButton();
      showToast('No se pudo abrir el login de YouTube', 'error');
    }
  });

  // Cookies extraídas desde el WebView
  onCookiesExtracted((success) => {
    resetLoginButton();
    if (success) {
      checkCookies().then((r) => {
        updateCookieStatus(r);
        showToast('Sesión de YouTube conectada', 'success');
      });
    }
  });

  // Auto-verificar al iniciar
  checkCookies().then(updateCookieStatus);
}
