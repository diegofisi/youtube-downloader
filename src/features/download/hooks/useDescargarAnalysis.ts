import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { t } from '@/shared/lib/messages/t';
import { queryClient } from '@/shared/lib/query-client';
import { useTauriEvent } from '@/shared/hooks/useTauriEvent';
import { useAnalyzeUrls } from '../api/analyze-urls/useAnalyzeUrls';
import { fetchDownloadDefaults } from '../api/get-settings/useDownloadDefaults';
import { fetchHistoryDto } from '../api/get-history/useDownloadedKeys';
import { toDownloadedKeys } from '../api/get-history/get-history.dto';
import type { AnalyzedEntry } from '../models/analyzed.model';
import { STATUS_META, flattenVideos, statusOf } from '../helpers/analysis';
import { addRecentLinks } from '../helpers/recent-links';
import { parseUrls } from '../helpers/parse-urls';
import { useDownloadStore } from '../stores/useDownloadStore';

export interface AnalyzeProgress {
  done: number;
  total: number;
}

// Guards await gaps in post-analysis work so only the latest run touches shared state.
let batchSeq = 0;

async function handleAnalyzed(entries: AnalyzedEntry[], urls: string[], seq: number): Promise<void> {
  // Fetch via the SHARED key so the badges' cache updates in the same round trip.
  const downloaded = toDownloadedKeys(
    await queryClient.fetchQuery({ queryKey: ['library', 'history'], queryFn: fetchHistoryDto }).catch(() => []),
  );
  if (seq !== batchSeq) return; // superseded by a newer analysis

  const vids = flattenVideos(entries);
  const selected = new Set<string>();
  // Auto-select only small batches to avoid checking hundreds by accident.
  if (vids.length <= 20) {
    for (const v of vids) {
      const st = statusOf(v, downloaded);
      if (STATUS_META[st].downloadable && !v.dup && st !== 'downloaded') selected.add(v.url);
    }
  }
  if (vids.length > 20) {
    toast.info(t.download.largeList(), {
      description: t.download.analyzedToast({ n: vids.length }),
    });
  }
  useDownloadStore.getState().setBatch(entries, selected);
  addRecentLinks(urls);

  // Read the setting fresh (not cached) so a recent toggle is honored before auto-clearing.
  const cfg = await fetchDownloadDefaults().catch(() => null);
  if (seq !== batchSeq) return;
  if (cfg?.clearLinksAfterPreview !== false) useDownloadStore.getState().setUrlsText('');
}

export function useDescargarAnalysis() {
  const { mutate, isPending } = useAnalyzeUrls();
  const [progress, setProgress] = useState<AnalyzeProgress | null>(null);

  useTauriEvent<[number, number]>('preview-progress', ([done, total]) => {
    setProgress({ done, total });
  });

  const analyze = useCallback(() => {
    const urls = parseUrls(useDownloadStore.getState().urlsText);
    if (urls.length === 0) {
      toast.warning(t.download.noLinksTitle(), {
        description: t.download.noLinksToast(),
      });
      return;
    }
    const seq = ++batchSeq;
    setProgress(null);
    mutate(
      { urls },
      {
        // mutate-level callbacks fire only for the latest call, so stale runs are dropped.
        onSuccess: (entries) => void handleAnalyzed(entries, urls, seq),
        onError: (e) => useDownloadStore.getState().setAnalyzeError(String(e)),
        onSettled: () => setProgress(null),
      },
    );
  }, [mutate]);

  return { analyze, isAnalyzing: isPending, progress };
}
