import { useEffect } from 'react';
import { useDownloadDefaults } from '../api/get-settings/useDownloadDefaults';
import { useDownloadStore } from '../stores/useDownloadStore';

/** Applies the Settings defaults on entry (the query refetches on mount), but ONLY
 * with no batch loaded — never clobber per-batch tweaks mid-session (vanilla parity). */
export function useApplySettingsDefaults(): void {
  const { data: defaults } = useDownloadDefaults();

  useEffect(() => {
    if (!defaults) return;
    const store = useDownloadStore.getState();
    if (store.entries.length === 0) store.applySettingsDefaults(defaults);
  }, [defaults]);
}
