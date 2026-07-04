import { invoke } from '@/shared/lib/tauri';
import { queryClient } from '@/shared/lib/query-client';

async function refreshSessionQueries(): Promise<void> {
  try {
    await queryClient.invalidateQueries({ queryKey: ['session'] });
  } catch {
    /* noop — a failed refetch must not mask the reconnect result */
  }
}

// Single-flight: if a silent reconnect is already in flight, the promise is shared.
// React Query dedupes queries, not imperative mutations — the shared promise survives.
let silentReconnectInFlight: Promise<boolean> | null = null;

/** Plain function (not a hook) so the queue store can call it outside React. */
export function attemptSilentReconnect(): Promise<boolean> {
  if (silentReconnectInFlight) return silentReconnectInFlight;

  silentReconnectInFlight = (async () => {
    try {
      const ok = await invoke<boolean>('refresh_session_silent');
      await refreshSessionQueries();
      return ok;
    } catch {
      await refreshSessionQueries();
      return false;
    } finally {
      silentReconnectInFlight = null;
    }
  })();

  return silentReconnectInFlight;
}
