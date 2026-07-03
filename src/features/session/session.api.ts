import { open } from '@tauri-apps/plugin-dialog';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { invoke, onEvent, type UnlistenFn } from '../../core/tauri/client';
import type { AccountInfo, CookieResult } from './session.types';

export async function checkCookies(): Promise<CookieResult> {
  return invoke<CookieResult>('check_cookies');
}

export async function loadCookies(): Promise<CookieResult> {
  const selected = await open({
    title: 'Selecciona tu archivo cookies.txt',
    filters: [
      { name: 'Cookies', extensions: ['txt'] },
      { name: 'Todos', extensions: ['*'] },
    ],
  });

  if (!selected) {
    return { status: 'cancelled' };
  }

  const filePath = typeof selected === 'string' ? selected : (selected as { path: string }).path;
  return invoke<CookieResult>('load_cookies', { path: filePath });
}

export async function openYouTubeLogin(): Promise<void> {
  return invoke('open_youtube_login');
}

export type SessionStatus = 'none' | 'expired' | 'connected';

export async function getSessionStatus(): Promise<SessionStatus> {
  return invoke<SessionStatus>('get_session_status');
}

/**
 * Nombre, handle y avatar de la cuenta de YouTube conectada.
 * Resuelve null si no hay sesión o YouTube no devuelve cuenta.
 */
export async function getAccountInfo(): Promise<AccountInfo | null> {
  return invoke<AccountInfo | null>('get_account_info');
}

export async function logoutSession(): Promise<void> {
  return invoke('logout');
}

/**
 * Intenta refrescar la sesión de YouTube sin interacción (ventana oculta).
 * Resuelve true si se re-extrajeron cookies; false si hace falta login manual.
 */
export async function refreshSessionSilent(): Promise<boolean> {
  return invoke<boolean>('refresh_session_silent');
}

export function onCookiesExtracted(cb: (success: boolean) => void): Promise<UnlistenFn> {
  return onEvent<boolean>('cookies-extracted', cb);
}

/** Abre una URL externa (páginas de extensiones de navegador). */
export async function openUrl(url: string): Promise<void> {
  await shellOpen(url);
}
