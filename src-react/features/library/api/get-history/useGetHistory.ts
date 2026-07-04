import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { LibraryEntry } from '../../models/library-entry.model';
import { toLibraryEntries, type LibraryEntryDTOResponse } from './get-history.dto';

// Pinned contract: the queue store invalidates EXACTLY this key on completion.
export const LIBRARY_HISTORY_KEY = ['library', 'history'] as const;

export function useGetHistory(
  options?: Omit<
    UseQueryOptions<LibraryEntryDTOResponse[], Error, LibraryEntry[]>,
    'queryKey' | 'queryFn' | 'select'
  >,
) {
  return useQuery<LibraryEntryDTOResponse[], Error, LibraryEntry[]>({
    queryKey: LIBRARY_HISTORY_KEY,
    queryFn: () => invoke<LibraryEntryDTOResponse[]>('get_history'),
    select: toLibraryEntries,
    ...options,
  });
}
