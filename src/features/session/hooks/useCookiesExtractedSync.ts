import { toast } from 'sonner';
import { useTauriEvent } from '@/shared/hooks/useTauriEvent';
import { queryClient } from '@/shared/lib/query-client';
import { t } from '@/shared/lib/messages/t';
import { resetSilentReconnectCooldown } from '../api/refresh-session-silent/attemptSilentReconnect';

/** On 'cookies-extracted': success refreshes status AND account (avatar/name may change),
 * lifts the silent-reconnect cooldown and runs `onSuccess`; failure is told to the user. */
export function useCookiesExtractedSync(onSuccess?: () => void): void {
  useTauriEvent<boolean>('cookies-extracted', (success) => {
    if (success) {
      resetSilentReconnectCooldown();
      void queryClient.invalidateQueries({ queryKey: ['session'] });
      onSuccess?.();
    } else {
      toast.error(t.session.cookiesExtractFailed());
    }
  });
  // The login window closed without a login: re-read the status so the UI is not stale.
  useTauriEvent<null>('login-window-closed', () => {
    void queryClient.invalidateQueries({ queryKey: ['session', 'status'] });
  });
}
