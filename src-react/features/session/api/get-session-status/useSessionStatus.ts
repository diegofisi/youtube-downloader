import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { SessionStatus } from '../../models/session-status.model';
import { toSessionStatus, type SessionStatusDTOResponse } from './get-session-status.dto';

const SESSION_RECHECK_MS = 10 * 60 * 1000;

export function useSessionStatus(
  options?: Omit<
    UseQueryOptions<SessionStatusDTOResponse, Error, SessionStatus>,
    'queryKey' | 'queryFn' | 'select'
  >,
) {
  return useQuery<SessionStatusDTOResponse, Error, SessionStatus>({
    queryKey: ['session', 'status'],
    queryFn: () => invoke<SessionStatusDTOResponse>('get_session_status'),
    select: toSessionStatus, // Adapter: DTO → Model
    // Cookie expiry has no push event: poll every 10 min like the vanilla setInterval.
    refetchInterval: SESSION_RECHECK_MS,
    ...options,
  });
}
