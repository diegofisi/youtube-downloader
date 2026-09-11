import { useEffect, useRef } from 'react';
import { useSessionStatus } from '../api/get-session-status/useSessionStatus';
import { attemptSilentReconnect } from '../api/refresh-session-silent/attemptSilentReconnect';
import { SessionStatus } from '../models/session-status.model';

/** Each time the stored cookies turn out expired (startup or the 10-min poll), tries ONE
 * silent renewal; the helper's cooldown and single-flight bound the cost. */
export function useSilentReconnectOnExpiry(): void {
  const { data: status } = useSessionStatus();
  const prev = useRef<SessionStatus | undefined>(undefined);
  useEffect(() => {
    const entered = status === SessionStatus.Expired && prev.current !== SessionStatus.Expired;
    prev.current = status;
    if (entered) void attemptSilentReconnect();
  }, [status]);
}
