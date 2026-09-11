import { invoke } from '@/shared/lib/tauri';
import { queryClient } from '@/shared/lib/query-client';
import { SessionStatus } from '../../models/session-status.model';
import type { SessionStatusDTOResponse } from '../get-session-status/get-session-status.dto';

/** After a failed attempt, later callers get `false` at once instead of another 20s hidden window. */
const FAILURE_COOLDOWN_MS = 60 * 1000;

async function refreshSessionQueries(): Promise<void> {
  try {
    await queryClient.invalidateQueries({ queryKey: ['session'] }, { cancelRefetch: false });
  } catch {
    /* noop — a failed refetch must not mask the reconnect result */
  }
}

// Single-flight: if a silent reconnect is already in flight, the promise is shared.
// React Query dedupes queries, not imperative mutations — the shared promise survives.
let silentReconnectInFlight: Promise<boolean> | null = null;
let lastFailureAt = 0;

/** Clears the failure cooldown: called when cookies arrive from an interactive login. */
export function resetSilentReconnectCooldown(): void {
  lastFailureAt = 0;
}

function cachedStatus(): SessionStatusDTOResponse | undefined {
  return queryClient.getQueryData<SessionStatusDTOResponse>(['session', 'status']);
}

/** Plain function (not a hook) so the queue store can call it outside React. No hidden
 * window without a stored session (nothing to renew) or during the post-failure cooldown. */
export function attemptSilentReconnect(): Promise<boolean> {
  if (silentReconnectInFlight) return silentReconnectInFlight;
  if (cachedStatus() === SessionStatus.None) return Promise.resolve(false);
  if (Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) return Promise.resolve(false);

  silentReconnectInFlight = (async () => {
    const ok = await invoke<boolean>('refresh_session_silent').catch((e: unknown) => {
      console.warn('[session] refresh_session_silent failed:', e);
      return false;
    });
    // Success already refreshed the queries through the cookies-extracted event.
    if (!ok) {
      lastFailureAt = Date.now();
      await refreshSessionQueries();
    }
    return ok;
  })().finally(() => {
    silentReconnectInFlight = null;
  });

  return silentReconnectInFlight;
}
