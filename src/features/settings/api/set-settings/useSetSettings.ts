import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { SettingsUpdate } from '../../models/settings.model';
import type { SettingsDTOResponse } from '../get-settings/get-settings.dto';
import { patchSettingsDTO, toSetSettingsDTO } from './set-settings.dto';

// Saves are chained: concurrent set_settings calls (debounced template + immediate
// toggles) must not land out of order. Call order == save order.
let saveChain: Promise<unknown> = Promise.resolve();

export function useSetSettings() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, SettingsUpdate>({
    mutationFn: (update) => {
      const run = () => invoke<void>('set_settings', { ...toSetSettingsDTO(update) });
      const save = saveChain.then(run, run); // proceed even if the previous link failed
      saveChain = save.catch(() => undefined);
      return save;
    },
    onSuccess: (_data, update) => {
      // No invalidation: a refetch mid-edit could clobber the form. Patch the cache instead.
      queryClient.setQueryData<SettingsDTOResponse>(['settings'], (old) => (old ? patchSettingsDTO(old, update) : old));
    },
  });
}
