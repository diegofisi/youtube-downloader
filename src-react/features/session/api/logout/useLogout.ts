import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { SessionStatusDTOResponse } from '../get-session-status/get-session-status.dto';

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => invoke<void>('logout'),
    onSuccess: () => {
      // Vanilla doLogout: status drops to 'none' immediately and the cached
      // account info is invalidated (no refetch needed — cookies are gone).
      queryClient.setQueryData<SessionStatusDTOResponse>(['session', 'status'], 'none');
      queryClient.removeQueries({ queryKey: ['session', 'account'] });
    },
  });
}
