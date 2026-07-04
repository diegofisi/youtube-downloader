import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@/shared/lib/tauri';
import type { SettingsUpdate } from '../../models/settings.model';
import type { SettingsDTOResponse } from '../get-settings/get-settings.dto';
import { patchSettingsDTO, toSetSettingsDTO } from './set-settings.dto';

// Chained so concurrent saves (debounced template + immediate toggles) land in call order.
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
      // Patch, don't invalidate: a refetch mid-edit could clobber the form.
      queryClient.setQueryData<SettingsDTOResponse>(['settings'], (old) => (old ? patchSettingsDTO(old, update) : old));
    },
  });
}
