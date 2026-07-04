import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { DownloadDefaults } from '../../models/download-opts.model';
import { toDownloadDefaults, type DownloadSettingsDTOResponse } from './get-settings.dto';

/** Fresh imperative read (auto-clear check honors settings changed seconds ago). */
export const fetchDownloadDefaults = async (): Promise<DownloadDefaults> =>
  toDownloadDefaults(await invoke<DownloadSettingsDTOResponse>('get_settings'));

/** Local settings read (§4.15): distinct key so it never collides with the settings slice. */
export function useDownloadDefaults(
  options?: Omit<
    UseQueryOptions<DownloadSettingsDTOResponse, Error, DownloadDefaults>,
    'queryKey' | 'queryFn' | 'select'
  >,
) {
  return useQuery<DownloadSettingsDTOResponse, Error, DownloadDefaults>({
    queryKey: ['download', 'settings'],
    queryFn: () => invoke<DownloadSettingsDTOResponse>('get_settings'),
    select: toDownloadDefaults,
    ...options,
  });
}
