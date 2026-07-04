import { useEffect } from 'react';
import { useDownloadPrefill } from '../stores/useDownloadPrefill';
import { useDownloadStore } from '../stores/useDownloadStore';

/** Appends pending prefill urls without dupes then auto-analyzes (descargar:prefill parity). */
export function useConsumePrefill(analyze: () => void): void {
  const pending = useDownloadPrefill((s) => s.urls);

  useEffect(() => {
    if (pending.length === 0) return;
    const urls = useDownloadPrefill.getState().consume();
    if (urls.length === 0) return;
    useDownloadStore.getState().appendUrls(urls);
    analyze();
  }, [pending, analyze]);
}
