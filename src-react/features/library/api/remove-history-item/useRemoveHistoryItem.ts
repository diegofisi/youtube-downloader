import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import { LIBRARY_HISTORY_KEY } from '../get-history/useGetHistory';
import type { LibraryEntryDTOResponse } from '../get-history/get-history.dto';

/** Removes an entry from the history (the file on disk is untouched). */
export function useRemoveHistoryItem() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => invoke<void>('remove_history_item', { id }),
    // Intrinsic cache update: drop the row without refetching (mirrors vanilla).
    onSuccess: (_data, { id }) => {
      queryClient.setQueryData<LibraryEntryDTOResponse[]>(LIBRARY_HISTORY_KEY, (old) =>
        old?.filter((e) => e.id !== id),
      );
    },
  });
}
