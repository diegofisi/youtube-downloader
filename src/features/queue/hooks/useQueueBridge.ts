import { useEffect } from 'react';
import { useTauriEvent } from '@/shared/hooks/useTauriEvent';
import { queryClient } from '@/shared/lib/query-client';
import { useCookiesExtractedSync } from '@/features/session';
import type { DownloadProgress } from '../models/download-progress.model';
import { getConcurrency } from '../api/get-concurrency/getConcurrency';
import { useQueueStore } from '../stores/useQueueStore';

/** Call once from the shell so the scheduler runs even when /cola is not mounted. */
export function useQueueBridge() {
  useTauriEvent<DownloadProgress>('download-progress', (p) => useQueueStore.getState().handleProgress(p));
  useCookiesExtractedSync();

  useEffect(() => {
    getConcurrency()
      .then((n) => useQueueStore.getState().setConcurrency(n))
      .catch(() => {}); // settings unavailable: keep the default of 5

    // Live sync: useSetSettings patches the ['settings'] cache on every save.
    return queryClient.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (key.length !== 1 || key[0] !== 'settings') return;
      const dto = event.query.state.data as { default_concurrency?: number } | undefined;
      if (typeof dto?.default_concurrency !== 'number') return;
      const { concurrency, setConcurrency } = useQueueStore.getState();
      const next = dto.default_concurrency <= 0 ? Infinity : dto.default_concurrency;
      if (next !== concurrency) setConcurrency(dto.default_concurrency);
    });
  }, []);
}
