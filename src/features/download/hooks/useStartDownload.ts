import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { t } from '@/shared/lib/i18n';
import { AppPath } from '@/shared/routes/app-path';
// Pinned contract: the queue slice's public facade (built in parallel).
import { useQueueStore, type EnqueueItem } from '@/features/queue';
import { useCookieMode } from '../api/get-session-status/useCookieMode';
import { useDownloadedKeys } from '../api/get-history/useDownloadedKeys';
import { STATUS_META, flattenVideos, statusOf } from '../helpers/analysis';
import { effectiveOpts, fmtDescription, optsToBackend } from '../helpers/opts';
import { gradFor } from '../helpers/format';
import { useDownloadStore } from '../stores/useDownloadStore';

const EMPTY_KEYS: ReadonlySet<string> = new Set();

/** Enqueues the selected downloadable videos and jumps to the queue view. */
export function useStartDownload(): () => void {
  const navigate = useNavigate();
  const { data: cookieMode } = useCookieMode();
  const { data: downloadedKeys } = useDownloadedKeys();

  return useCallback(() => {
    const { entries, selected, opts, overrides } = useDownloadStore.getState();
    const downloaded = downloadedKeys ?? EMPTY_KEYS;
    const chosen = flattenVideos(entries).filter(
      (v) => selected.has(v.url) && STATUS_META[statusOf(v, downloaded)].downloadable,
    );
    if (chosen.length === 0) {
      toast.warning(t('Nada seleccionado', 'Nothing selected'), {
        description: t('Marca al menos un video descargable.', 'Check at least one downloadable video.'),
      });
      return;
    }
    const mode = cookieMode ?? 'none';
    const items: EnqueueItem[] = chosen.map((v) => {
      const eff = effectiveOpts(opts, overrides[v.url]);
      return {
        url: v.url,
        videoId: v.id || undefined,
        title: v.title,
        channel: v.channel,
        duration: v.duration,
        grad: gradFor(v.id || v.url),
        thumbnail: v.thumbnail,
        fmt: fmtDescription(eff),
        options: optsToBackend(eff, mode),
      };
    });
    useQueueStore.getState().enqueue(items);
    // Clear the selection so pressing "Download" again doesn't enqueue duplicates;
    // the preview is kept in case other videos are picked next.
    useDownloadStore.getState().clearSelection();
    void navigate(AppPath.COLA);
    toast.success(t('Añadido a la cola', 'Added to queue'), {
      description: t(
        `${items.length} ${items.length === 1 ? 'video' : 'videos'} en proceso.`,
        `${items.length} ${items.length === 1 ? 'video' : 'videos'} in progress.`,
      ),
    });
  }, [navigate, cookieMode, downloadedKeys]);
}
