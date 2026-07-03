import { invoke, onEvent, type UnlistenFn } from '../../core/tauri/client';
import type { AccountInfo } from './session.types';

export async function openYouTubeLogin(): Promise<void> {
  return invoke('open_youtube_login');
}

export type SessionStatus = 'none' | 'expired' | 'connected';

export async function getSessionStatus(): Promise<SessionStatus> {
  return invoke<SessionStatus>('get_session_status');
}

/** Name, handle and avatar of the connected YouTube account.
 * Resolves null if there is no session or YouTube returns no account. */
export async function getAccountInfo(): Promise<AccountInfo | null> {
  return invoke<AccountInfo | null>('get_account_info');
}

export async function logoutSession(): Promise<void> {
  return invoke('logout');
}

/** Tries to refresh the YouTube session without interaction (hidden window).
 * Resolves true if cookies were re-extracted; false if manual login is needed. */
export async function refreshSessionSilent(): Promise<boolean> {
  return invoke<boolean>('refresh_session_silent');
}

export function onCookiesExtracted(cb: (success: boolean) => void): Promise<UnlistenFn> {
  return onEvent<boolean>('cookies-extracted', cb);
}
