import { useMutation } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';

// Duplicated in settings on purpose: features never share hooks — each
// slice owns its adapter for the commands it uses.
export function useOpenDownloadsFolder() {
  return useMutation<void, Error>({
    mutationFn: () => invoke<void>('open_downloads_folder'),
  });
}
