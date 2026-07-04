import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';

/** Informational folder line (changed from Settings). Plain string response → no DTO file.
 * Distinct key from the settings slice (§4.15); staleTime 0 refetches on every mount. */
export function useGetDownloadFolder(
  options?: Omit<UseQueryOptions<string, Error, string>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<string, Error, string>({
    queryKey: ['download', 'downloadFolder'],
    queryFn: () => invoke<string>('get_download_folder'),
    ...options,
  });
}
