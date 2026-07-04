import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { t } from '@/shared/lib/messages/t';
import { useTauriEvent } from '@/shared/hooks/useTauriEvent';
import { useCheckDependencies } from '../api/check-dependencies/useCheckDependencies';
import { useDownloadDependencies } from '../api/download-dependencies/useDownloadDependencies';
import type { SetupProgress } from '../models/setup-progress.model';

export function useTroubleshooting() {
  const { data: status, isLoading: checking } = useCheckDependencies();
  const { mutate: repair, isPending: repairing } = useDownloadDependencies();
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError(String(e));
        toast.error(t.settings.repairErrorToast(), { description: String(e) });
      },
    });
  }, [repair, repairing]);

  return { status, checking, repairing, progress, error, onRepair };
}
