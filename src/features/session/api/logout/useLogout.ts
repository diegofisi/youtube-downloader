import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { SessionStatusDTOResponse } from '../get-session-status/get-session-status.dto';

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => invoke<void>('logout'),
    onSuccess: () => {
      // Drop to 'none' immediately; no refetch needed since cookies are gone.
      queryClient.setQueryData<SessionStatusDTOResponse>(['session', 'status'], 'none');
      queryClient.removeQueries({ queryKey: ['session', 'account'] });
    },
  });
}
