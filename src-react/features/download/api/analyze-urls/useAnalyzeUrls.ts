import { useMutation } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { AnalyzedEntry } from '../../models/analyzed.model';
import { toAnalyzedEntry, type AnalyzedEntryDTO } from './analyze-urls.dto';

/** One-shot paste analysis (Descargar); progress arrives via the preview-progress event. */
export function useAnalyzeUrls() {
  return useMutation<AnalyzedEntry[], Error, { urls: string[] }>({
    mutationFn: async ({ urls }) =>
      (await invoke<AnalyzedEntryDTO[]>('analyze_urls', { urls })).map(toAnalyzedEntry),
  });
}
