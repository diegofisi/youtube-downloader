import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { t } from '@/shared/lib/i18n';
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

// Guards the await gaps of post-analysis work: only the latest run may touch shared
// state (mutate() callbacks already only fire for the latest call — RQ semantics).
let batchSeq = 0;

async function handleAnalyzed(entries: AnalyzedEntry[], urls: string[], seq: number): Promise<void> {
  // Fresh history through the SHARED key: updates the badges' cache in the same round trip.
  const downloaded = toDownloadedKeys(
    await queryClient
      .fetchQuery({ queryKey: ['library', 'history'], queryFn: fetchHistoryDto })
      .catch(() => []),
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
    toast.info(t('Lista grande', 'Large list'), {
      description: t(
        `${vids.length} videos — elige cuáles descargar (o "Seleccionar todo").`,
        `${vids.length} videos — choose which to download (or "Select all").`,
      ),
    });
  }
  useDownloadStore.getState().setBatch(entries, selected);
  addRecentLinks(urls);

  // Auto-clear the links box after a successful analysis unless the setting
  // disables it; read fresh to honor recent changes.
  const cfg = await fetchDownloadDefaults().catch(() => null);
  if (seq !== batchSeq) return;
  if (cfg?.clearLinksAfterPreview !== false) useDownloadStore.getState().setUrlsText('');
}

/** Analyze orchestration: parse → mutate → auto-select/prune/recents/auto-clear (§4.17 C). */
export function useDescargarAnalysis() {
  const { mutate, isPending } = useAnalyzeUrls();
  const [progress, setProgress] = useState<AnalyzeProgress | null>(null);

  // View-scoped analyzing counter; the page only shows it while isAnalyzing.
  useTauriEvent<[number, number]>('preview-progress', ([done, total]) => {
    setProgress({ done, total });
  });

  const analyze = useCallback(() => {
    const urls = parseUrls(useDownloadStore.getState().urlsText);
    if (urls.length === 0) {
      toast.warning(t('Sin enlaces', 'No links'), {
        description: t('Pega al menos un enlace para previsualizar.', 'Paste at least one link to preview.'),
      });
      return;
    }
    const seq = ++batchSeq;
    setProgress(null);
    mutate(
      { urls },
      {
        // mutate-level callbacks fire only for the latest call → stale runs are dropped by RQ.
        onSuccess: (entries) => void handleAnalyzed(entries, urls, seq),
        onError: (e) => useDownloadStore.getState().setAnalyzeError(String(e)),
        onSettled: () => setProgress(null),
      },
    );
  }, [mutate]);

  return { analyze, isAnalyzing: isPending, progress };
}
