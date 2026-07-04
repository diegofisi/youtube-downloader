import { useQuery } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';

// Primitive string response → DTO-file exception applies (no mapper needed).
export function useGetDownloadFolder() {
  return useQuery<string>({
    queryKey: ['settings', 'downloadFolder'],
    queryFn: () => invoke<string>('get_download_folder'),
  });
}
