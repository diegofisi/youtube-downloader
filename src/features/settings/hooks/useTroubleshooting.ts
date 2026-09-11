import { useCallback, useState } from 'react';
import { errorText } from '@/shared/lib/error-text';
import { toast } from 'sonner';
import { t } from '@/shared/lib/messages/t';
import { useTauriEvent } from '@/shared/hooks/useTauriEvent';
import { useCheckDependencies } from '../api/check-dependencies/useCheckDependencies';
import { useDownloadDependencies } from '../api/download-dependencies/useDownloadDependencies';
import { useCheckDependencySources } from '../api/check-dependency-sources/useCheckDependencySources';
import type { SetupProgress } from '../models/setup-progress.model';

export function useTroubleshooting() {
  const { data: status, isLoading: checking } = useCheckDependencies();
  const { mutate: repair, isPending: repairing } = useDownloadDependencies();
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourcesCheck = useCheckDependencySources();

  useTauriEvent<SetupProgress>('setup-progress', (p) => {
    setProgress({ ...p, percent: Math.min(100, Math.max(0, p.percent)) });
  });

  const onRepair = useCallback(() => {
    if (repairing) return;
    setError(null);
    setProgress(null);
    repair(undefined, {
      onSuccess: () => {
        setProgress(null);
        toast.success(t.settings.repairDoneToast());
      },
      onError: (e) => {
        // The error stays visible in the panel (not cleared) in addition to the toast.
        setError(errorText(e));
        toast.error(t.settings.repairErrorToast(), { description: errorText(e) });
      },
    });
  }, [repair, repairing]);

  const onCheckSources = useCallback(() => {
    if (sourcesCheck.isPending) return;
    sourcesCheck.mutate(undefined, {
      onError: (e) => toast.error(t.settings.sourcesCheckError(), { description: errorText(e) }),
    });
  }, [sourcesCheck]);

  return {
    status,
    checking,
    repairing,
    progress,
    error,
    onRepair,
    sources: sourcesCheck.data ?? null,
    checkingSources: sourcesCheck.isPending,
    onCheckSources,
  };
}
