import { useEffect } from 'react';
import { useTauriEvent } from '@/shared/hooks/useTauriEvent';
import { queryClient } from '@/shared/lib/query-client';
import { useCookiesExtractedSync } from '@/features/session';
import type { DownloadProgress } from '../models/download-progress.model';
import { getConcurrency } from '../api/get-concurrency/getConcurrency';
import { useQueueStore } from '../stores/useQueueStore';

/** Headless bridge mounted once in AppShell: feeds the queue scheduler with the
 * global 'download-progress' event, wires the session 'cookies-extracted' sync and
 * keeps the concurrency in step with the ['settings'] cache (Ajustes autosave). */
export const QueueBridge = () => {
  useTauriEvent<DownloadProgress>('download-progress', (p) => useQueueStore.getState().handleProgress(p));
  useCookiesExtractedSync();

  useEffect(() => {
    // Initial concurrency from get_settings (0 → Infinity handled by the store action).
    getConcurrency()
      .then((n) => useQueueStore.getState().setConcurrency(n))
      .catch(() => {}); // settings unavailable: keep the default of 5

    // Live sync: useSetSettings patches the ['settings'] DTO cache on every save.
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

  return null;
};
