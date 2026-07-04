import { useQuery } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';

export function useGetDownloadFolder() {
  return useQuery<string>({
    queryKey: ['settings', 'downloadFolder'],
    queryFn: () => invoke<string>('get_download_folder'),
  });
}
