import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import { toDownloadedKeys, type HistoryEntryDTOResponse } from './get-history.dto';

/** Raw fetcher, reused by the analysis hook via queryClient.fetchQuery. */
export const fetchHistoryDto = (): Promise<HistoryEntryDTOResponse[]> =>
  invoke<HistoryEntryDTOResponse[]>('get_history');

/** SHARED key ['library','history'] (pinned contract): the queue store invalidates it on
 * completion, so "Ya descargado" badges update live without re-analyzing. Read-only here. */
export function useDownloadedKeys(
  options?: Omit<
    UseQueryOptions<HistoryEntryDTOResponse[], Error, Set<string>>,
    'queryKey' | 'queryFn' | 'select'
  >,
) {
  return useQuery<HistoryEntryDTOResponse[], Error, Set<string>>({
    queryKey: ['library', 'history'],
    queryFn: fetchHistoryDto,
    select: toDownloadedKeys,
    ...options,
  });
}
