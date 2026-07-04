import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import { SETUP_DEPENDENCIES_KEY } from '../check-dependencies/useCheckDependencies';

/** First-run install of the bundled tools. Progress arrives via `setup-progress`. */
export function useDownloadDependencies() {
  const queryClient = useQueryClient();
  return useMutation<void, Error>({
    mutationFn: () => invoke<void>('download_dependencies'),
    // Re-check after success AND failure — mirrors the vanilla finally block.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: SETUP_DEPENDENCIES_KEY }),
  });
}
