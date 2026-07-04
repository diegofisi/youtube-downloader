import { useMutation } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';

// Local hook (guideline §4.15): settings also opens this folder, but features
// never share hooks — each slice owns its adapter for the commands it uses.
export function useOpenDownloadsFolder() {
  return useMutation<void, Error>({
    mutationFn: () => invoke<void>('open_downloads_folder'),
  });
}
