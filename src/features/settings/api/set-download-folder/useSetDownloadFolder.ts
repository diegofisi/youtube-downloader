import { useMutation, useQueryClient } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@/shared/lib/tauri';
import { t } from '@/shared/lib/messages/t';

// Resolves null when the user cancels the OS folder picker.
export function useSetDownloadFolder() {
  const queryClient = useQueryClient();
  return useMutation<string | null, Error>({
    mutationFn: async () => {
      const selected = await open({
        title: t.settings.pickFolder(),
        directory: true,
      });
      if (!selected) return null;
      const folder = typeof selected === 'string' ? selected : (selected as { path: string }).path;
      return invoke<string>('set_download_folder', { folder });
    },
    onSuccess: (path) => {
      if (path === null) return;
      queryClient.setQueryData(['settings', 'downloadFolder'], path);
      // The full settings DTO caches the folder too (legacy snake_case field).
      queryClient.setQueryData<{ download_folder: string } | undefined>(['settings'], (old) =>
        old ? { ...old, download_folder: path } : old,
      );
    },
  });
}
