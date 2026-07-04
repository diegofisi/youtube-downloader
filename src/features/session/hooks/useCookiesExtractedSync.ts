import { useTauriEvent } from '@/shared/hooks/useTauriEvent';
import { queryClient } from '@/shared/lib/query-client';

/** On 'cookies-extracted' refresh status AND account (avatar/name may change). */
export function useCookiesExtractedSync(): void {
  useTauriEvent<boolean>('cookies-extracted', (success) => {
    if (success) void queryClient.invalidateQueries({ queryKey: ['session'] });
  });
}
