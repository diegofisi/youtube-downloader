import { toast } from 'sonner';
import { useTauriEvent } from '@/shared/hooks/useTauriEvent';
import { queryClient } from '@/shared/lib/query-client';
import { t } from '@/shared/lib/messages/t';
import {
  attemptSilentReconnect,
  resetSilentReconnectCooldown,
} from '../api/refresh-session-silent/attemptSilentReconnect';

// Told once per rejected session; a successful login re-arms it.
let rejectionNotified = false;

/** On 'cookies-extracted': success refreshes status AND account (avatar/name may change),
 * lifts the silent-reconnect cooldown and runs `onSuccess`; failure is told to the user. */
export function useCookiesExtractedSync(onSuccess?: () => void): void {
  useTauriEvent<boolean>('cookies-extracted', (success) => {
    if (success) {
      resetSilentReconnectCooldown();
      rejectionNotified = false;
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
  // YouTube rejected the stored cookies (the backend fell back to a cookie-less run):
  // renew silently, and if that fails tell the user once.
  useTauriEvent<null>('session-rejected', () => {
    void attemptSilentReconnect().then((renewed) => {
      if (renewed || rejectionNotified) return;
      rejectionNotified = true;
      toast.warning(t.session.rejectedTitle(), { description: t.session.rejectedBody() });
    });
  });
}
