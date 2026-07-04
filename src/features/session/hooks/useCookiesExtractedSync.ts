import { useTauriEvent } from '@/shared/hooks/useTauriEvent';
import { queryClient } from '@/shared/lib/query-client';

/** Global session bridge: after a successful login/reconnect the backend emits
 * 'cookies-extracted' — refresh status AND account (the avatar/name may change). */
export function useCookiesExtractedSync(): void {
  useTauriEvent<boolean>('cookies-extracted', (success) => {
    if (success) void queryClient.invalidateQueries({ queryKey: ['session'] });
  });
}
