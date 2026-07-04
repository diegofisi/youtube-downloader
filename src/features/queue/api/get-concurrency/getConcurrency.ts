import { invoke } from '@/shared/lib/tauri';
import { queryClient } from '@/shared/lib/query-client';
import type { ConcurrencySettingsDTOResponse } from './get-concurrency.dto';

/** Goes through the shared ['settings'] cache so a copy already loaded by Ajustes
 * is reused (staleTime Infinity mirrors useGetSettings). */
export async function getConcurrency(): Promise<number> {
  const dto = await queryClient.fetchQuery({
    queryKey: ['settings'],
    queryFn: () => invoke<ConcurrencySettingsDTOResponse>('get_settings'),
    staleTime: Infinity,
  });
  return dto.default_concurrency ?? 5;
}
