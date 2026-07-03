import {
  getSessionStatus,
  logoutSession,
  onCookiesExtracted,
  refreshSessionSilent,
  type SessionStatus,
} from './session.api';
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
    if (status === 'connected' && prev !== 'connected') bus.emit('session:connected');
    if (status === 'expired' && prev !== 'expired') bus.emit('session:expired');
    if (status !== prev) bus.emit('session:changed');
  } catch {
    /* noop */
  }
  return status;
}

// Single-flight: si ya hay una reconexión silenciosa en curso, se comparte la promesa.
let silentReconnectInFlight: Promise<boolean> | null = null;

/**
 * Intenta reconectar la sesión de YouTube sin interacción del usuario.
 * Devuelve true si se refrescaron las cookies; en cualquier caso re-lee el
 * estado de sesión (emite session:changed / session:connected / session:expired).
 */
export function attemptSilentReconnect(): Promise<boolean> {
  if (silentReconnectInFlight) return silentReconnectInFlight;

  silentReconnectInFlight = (async () => {
    try {
      const ok = await refreshSessionSilent();
      await refreshSession();
      return ok;
    } catch {
      await refreshSession();
      return false;
    } finally {
      silentReconnectInFlight = null;
    }
  })();

  return silentReconnectInFlight;
}

export async function doLogout(): Promise<void> {
  await logoutSession();
  status = 'none';
  bus.emit('session:changed');
}

export async function initSession(): Promise<void> {
  await refreshSession();
  void onCookiesExtracted((success) => {
    if (success) void refreshSession();
  });
  // Igual que en web, la sesión puede caducar con el tiempo: re-chequear periódicamente.
  setInterval(refreshSession, 10 * 60 * 1000);
}
