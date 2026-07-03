import { invoke, onEvent, type UnlistenFn } from '../../core/tauri/client';
import type { AccountInfo } from './session.types';

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
