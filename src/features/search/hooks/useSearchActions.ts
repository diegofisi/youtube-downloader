import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CARD_GRAD } from '@/shared/components/media/media-item';
import { t } from '@/shared/lib/messages/t';
import { AppPath } from '@/shared/routes/app-path';
import { useDownloadPrefill } from '@/features/download';
import { useQueueStore, type EnqueueItem } from '@/features/queue';
import { useSessionStatus } from '@/features/session';
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
    fmt: t.common.maxMp4(),
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
    toast.success(t.common.addedToQueue(), { description: v.title });
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
    toast.success(t.common.addedToQueue(), {
      description: t.download.downloadingToast({ n: items.length }),
    });
  };

  const customizeSelected = (items: SearchVideo[]) => {
    if (!items.length) return;
    useDownloadPrefill.getState().setUrls(items.map((v) => v.url));
    onSelectionDone();
    void navigate(AppPath.DESCARGAR);
    toast.info(t.common.customizeDownloadPrompt(), {
      description: t.search.readyToast({ n: items.length }),
    });
  };

  return { downloadOne, customizeOne, downloadSelected, customizeSelected };
}
