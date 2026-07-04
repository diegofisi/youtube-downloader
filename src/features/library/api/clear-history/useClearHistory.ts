import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import { LIBRARY_HISTORY_KEY } from '../get-history/useGetHistory';
import type { LibraryEntryDTOResponse } from '../get-history/get-history.dto';

/** Clears the whole history (downloaded files are NOT deleted). */
export function useClearHistory() {
  const queryClient = useQueryClient();
  return useMutation<void, Error>({
    mutationFn: () => invoke<void>('clear_history'),
    onSuccess: () => {
      queryClient.setQueryData<LibraryEntryDTOResponse[]>(LIBRARY_HISTORY_KEY, []);
    },
  });
}
