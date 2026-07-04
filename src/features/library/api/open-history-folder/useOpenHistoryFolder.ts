import { useMutation } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';

export function useOpenHistoryFolder() {
  return useMutation<void, Error, { folder: string }>({
    mutationFn: ({ folder }) => invoke<void>('open_history_folder', { folder }),
  });
}
