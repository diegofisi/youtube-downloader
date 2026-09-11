import { attemptSilentReconnect } from '../api/refresh-session-silent/attemptSilentReconnect';
import { isSessionAuthError } from '../models/session-auth-error';

/** Runs `task`; on a session rejection tries ONE silent reconnect and re-runs it.
 * Any other error (or a failed reconnect) propagates untouched so the caller can explain it. */
export async function runWithSessionRetry<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (e) {
    if (!isSessionAuthError(e)) throw e;
    const renewed = await attemptSilentReconnect();
    if (!renewed) throw e;
    return task();
  }
}
