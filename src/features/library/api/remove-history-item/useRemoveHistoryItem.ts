import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import { LIBRARY_HISTORY_KEY } from '../get-history/useGetHistory';
import type { LibraryEntryDTOResponse } from '../get-history/get-history.dto';

/** The file on disk is untouched, only the history record is removed. */
export function useRemoveHistoryItem() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => invoke<void>('remove_history_item', { id }),
    // No refetch, mirrors vanilla.
    onSuccess: (_data, { id }) => {
      queryClient.setQueryData<LibraryEntryDTOResponse[]>(LIBRARY_HISTORY_KEY, (old) =>
        old?.filter((e) => e.id !== id),
      );
    },
  });
}
