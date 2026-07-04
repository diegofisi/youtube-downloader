import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';

export function useDownloadDependencies() {
  const queryClient = useQueryClient();
  return useMutation<void, Error>({
    mutationFn: () => invoke<void>('download_dependencies'),
    // Re-check after success AND failure — mirrors the vanilla finally block.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['settings', 'dependencies'] }),
  });
}
