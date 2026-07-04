import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';

/** Local session read (§4.15) mapped to the cookieMode start_download expects.
 * With an expired session we still pass cookies (public videos work); only 'none' skips them. */
export function useCookieMode(
  options?: Omit<UseQueryOptions<string, Error, string>, 'queryKey' | 'queryFn' | 'select'>,
) {
  return useQuery<string, Error, string>({
    queryKey: ['download', 'session'],
    queryFn: () => invoke<string>('get_session_status'),
    select: (status) => (status === 'none' ? 'none' : 'file'),
    ...options,
  });
}
