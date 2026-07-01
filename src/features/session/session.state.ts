import { checkCookies, onCookiesExtracted } from './session.api';
import { bus } from '../../core/bus/event-bus';

let status: string = 'none';
let hasCookies = false;

export function getCookieMode(): string {
  return hasCookies ? 'file' : 'none';
}

export function isConnected(): boolean {
  return status === 'youtube' || status === 'generic';
}

async function refresh(): Promise<void> {
  try {
    const r = await checkCookies();
    status = r.status;
    hasCookies = status === 'youtube' || status === 'generic';
    if (isConnected()) bus.emit('session:connected', {});
  } catch {
    /* noop */
  }
}

export async function initSession(): Promise<void> {
  await refresh();
  onCookiesExtracted((success) => {
    if (success) refresh();
  });
}
