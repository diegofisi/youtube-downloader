import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { DeleteFileOutcome } from '../../models/delete-file-outcome.model';
import { LIBRARY_HISTORY_KEY } from '../get-history/useGetHistory';
import type { LibraryEntryDTOResponse } from '../get-history/get-history.dto';
import { toDeleteFileOutcome, type DeleteHistoryFileDTOResponse } from './delete-history-file.dto';

/** Deletes an entry's file (trash if possible, permanent as fallback)
 * and removes the entry from history. */
export function useDeleteHistoryFile() {
  const queryClient = useQueryClient();
  return useMutation<DeleteFileOutcome, Error, { id: string }>({
    mutationFn: async ({ id }) =>
      toDeleteFileOutcome(await invoke<DeleteHistoryFileDTOResponse>('delete_history_file', { id })),
    // The backend already removed the entry: drop the row from the cache.
    onSuccess: (_outcome, { id }) => {
      queryClient.setQueryData<LibraryEntryDTOResponse[]>(LIBRARY_HISTORY_KEY, (old) =>
        old?.filter((e) => e.id !== id),
      );
    },
  });
}
