import { useMutation, useQueryClient } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@/shared/lib/tauri';
import { t } from '@/shared/lib/i18n';

/** Opens the OS folder picker and persists the choice. Resolves null when the user cancels. */
export function useSetDownloadFolder() {
  const queryClient = useQueryClient();
  return useMutation<string | null, Error>({
    mutationFn: async () => {
      const selected = await open({
        title: t('Selecciona la carpeta de descargas', 'Choose the downloads folder'),
        directory: true,
      });
      if (!selected) return null;
      const folder = typeof selected === 'string' ? selected : (selected as { path: string }).path;
      return invoke<string>('set_download_folder', { folder });
    },
    onSuccess: (path) => {
      if (path !== null) queryClient.setQueryData(['settings', 'downloadFolder'], path);
    },
  });
}
