import { useEffect } from 'react';
import { useDownloadDefaults } from '../api/get-settings/useDownloadDefaults';
import { useDownloadStore } from '../stores/useDownloadStore';

/** Applies Settings defaults only when no batch is loaded, so per-batch tweaks are
 * never clobbered mid-session (vanilla parity). */
export function useApplySettingsDefaults(): void {
  const { data: defaults } = useDownloadDefaults();

  useEffect(() => {
    if (!defaults) return;
    const store = useDownloadStore.getState();
    if (store.entries.length === 0) store.applySettingsDefaults(defaults);
  }, [defaults]);
}
