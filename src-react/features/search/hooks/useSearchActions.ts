import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CARD_GRAD } from '@/shared/components/media/media-item';
import { t } from '@/shared/lib/i18n';
import { AppPath } from '@/shared/routes/app-path';
import { useDownloadPrefill } from '@/features/download/stores/useDownloadPrefill';
import { useQueueStore, type EnqueueItem } from '@/features/queue/stores/useQueueStore';
import { useSessionStatus } from '@/features/session/api/get-session-status/useSessionStatus';
import type { SearchVideo } from '../models/search-video.model';

/** Download/customize flows for the search grid (this slice's port of shared/ui/dl-actions).
 * Cross-feature access sanctioned by the R2 pinned contracts (queue/download/session). */
export function useSearchActions(onSelectionDone: () => void) {
  const navigate = useNavigate();
  const { data: sessionStatus } = useSessionStatus();

  // With an expired session we still pass the cookies (public videos keep working).
  const cookieMode = sessionStatus === 'connected' || sessionStatus === 'expired' ? 'file' : 'none';

  const toQueueItem = (v: SearchVideo): EnqueueItem => ({
    url: v.url,
    videoId: v.id,
    title: v.title,
    channel: v.channel,
    grad: CARD_GRAD,
    thumbnail: v.thumbnail,
    duration: v.duration,
    fmt: t('Máxima · MP4', 'Max · MP4'),
    options: {
      mode: 'video',
      quality: 'max',
      container: 'mp4',
      audioFormat: 'mp3',
      audioBitrate: 0,
      subtitles: false,
      subLangs: 'es,en',
      embedThumbnail: true,
      outputTemplate: undefined,
      cookieMode,
    },
  });

  const downloadOne = (v: SearchVideo) => {
    useQueueStore.getState().enqueue([toQueueItem(v)]);
    toast.success(t('Añadido a la cola', 'Added to queue'), { description: v.title });
  };

  const customizeOne = (v: SearchVideo) => {
    useDownloadPrefill.getState().setUrls([v.url]);
    void navigate(AppPath.DESCARGAR);
  };

  const downloadSelected = (items: SearchVideo[]) => {
    if (!items.length) return;
    useQueueStore.getState().enqueue(items.map(toQueueItem));
    onSelectionDone();
    void navigate(AppPath.COLA);
    toast.success(t('Añadido a la cola', 'Added to queue'), {
      description: t(
        `${items.length} ${items.length === 1 ? 'video' : 'videos'} en proceso.`,
        `${items.length} ${items.length === 1 ? 'video' : 'videos'} in progress.`,
      ),
    });
  };

  const customizeSelected = (items: SearchVideo[]) => {
    if (!items.length) return;
    useDownloadPrefill.getState().setUrls(items.map((v) => v.url));
    onSelectionDone();
    void navigate(AppPath.DESCARGAR);
    toast.info(t('Personaliza tu descarga', 'Customize your download'), {
      description: t(
        `${items.length} ${items.length === 1 ? 'video listo' : 'videos listos'} en Descargar.`,
        `${items.length} ${items.length === 1 ? 'video' : 'videos'} ready in Download.`,
      ),
    });
  };

  return { downloadOne, customizeOne, downloadSelected, customizeSelected };
}
