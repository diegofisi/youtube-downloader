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
  // With an expired session we still pass the cookies (public videos work),
  // but the UI warns that reconnecting is needed for members-only content.
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

// Single-flight: if a silent reconnect is already in flight, the promise is shared.
let silentReconnectInFlight: Promise<boolean> | null = null;

/** Tries to reconnect the YouTube session without user interaction. Returns true if cookies were
 * refreshed; always re-reads session state (emits session:changed / :connected / :expired). */
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
  // As on the web, the session can expire over time: re-check periodically.
  setInterval(refreshSession, 10 * 60 * 1000);
}
