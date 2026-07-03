import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { Settings } from '../../models/settings.model';
import { toSettings, type SettingsDTOResponse } from './get-settings.dto';

export function useGetSettings(
  options?: Omit<UseQueryOptions<SettingsDTOResponse, Error, Settings>, 'queryKey' | 'queryFn' | 'select'>,
) {
  return useQuery<SettingsDTOResponse, Error, Settings>({
    queryKey: ['settings'],
    queryFn: () => invoke<SettingsDTOResponse>('get_settings'),
    select: toSettings, // Adapter: DTO → Model
    // The autosave form is the source of truth after load (useSetSettings patches
    // the cache on save) — a background refetch mid-edit would clobber typing.
    staleTime: Infinity,
    ...options,
  });
}
