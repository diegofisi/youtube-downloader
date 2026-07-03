import { getSessionStatus, logoutSession, onCookiesExtracted, type SessionStatus } from './session.api';
import { bus } from '../../core/bus/event-bus';

let status: SessionStatus = 'none';

export function getCookieMode(): string {
  // Con sesión caducada seguimos pasando las cookies (los videos públicos funcionan),
  // pero la UI avisa que hace falta reconectar para contenido de miembros.
  return status === 'none' ? 'none' : 'file';
}

export function isConnected(): boolean {
  return status === 'connected';
}
export function isExpired(): boolean {
  return status === 'expired';
}

export async function refreshSession(): Promise<SessionStatus> {
  try {
    const prev = status;
    status = await getSessionStatus();
    if (status === 'connected' && prev !== 'connected') bus.emit('session:connected', {});
    if (status === 'expired' && prev !== 'expired') bus.emit('session:expired', undefined);
    if (status !== prev) bus.emit('session:changed', undefined);
  } catch {
    /* noop */
  }
  return status;
}

export async function doLogout(): Promise<void> {
  await logoutSession();
  status = 'none';
  bus.emit('session:changed', undefined);
}

export async function initSession(): Promise<void> {
  await refreshSession();
  onCookiesExtracted((success) => {
    if (success) refreshSession();
  });
  // Igual que en web, la sesión puede caducar con el tiempo: re-chequear periódicamente.
  setInterval(refreshSession, 10 * 60 * 1000);
}
