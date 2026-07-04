import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { AccountInfo } from '../../models/account-info.model';
import { SessionStatus } from '../../models/session-status.model';
import { useSessionStatus } from '../get-session-status/useSessionStatus';
import { toAccountInfo, type AccountInfoDTOResponse } from './get-account-info.dto';

export function useAccountInfo(
  options?: Omit<
    UseQueryOptions<AccountInfoDTOResponse | null, Error, AccountInfo | null>,
    'queryKey' | 'queryFn' | 'select' | 'enabled'
  >,
) {
  const { data: status } = useSessionStatus();
  return useQuery<AccountInfoDTOResponse | null, Error, AccountInfo | null>({
    queryKey: ['session', 'account'],
    queryFn: () => invoke<AccountInfoDTOResponse | null>('get_account_info'),
    select: toAccountInfo,
    enabled: status === SessionStatus.Connected,
    // Cache a resolved value (even null) for the session; transient failures aren't
    // cached — `retry` covers them and an errored query refetches on remount.
    staleTime: Infinity,
    retry: 2,
    ...options,
  });
}
