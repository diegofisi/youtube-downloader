import { CheckIcon, RotateCcwIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { H1, P } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/i18n';
import { QueueStatus } from '../models/queue-item.model';
import { useQueueStore } from '../stores/useQueueStore';
import { QueueStats } from '../components/QueueStats';
import { QueueItemCard } from '../components/QueueItemCard';
import { QueueEmpty } from '../components/QueueEmpty';

// Stripe animation for the active progress bar (vanilla stash.css @keyframes barflow).
const BARFLOW_CSS = '@keyframes barflow{from{background-position:0 0}to{background-position:28px 0}}';

/** Pattern A (page absorbs): the queue store is the only data source; components stay dumb. */
export const ColaPage = () => {
  const items = useQueueStore((s) => s.items);
  const action = useQueueStore((s) => s.action);
  const move = useQueueStore((s) => s.move);
  const retryAllFailed = useQueueStore((s) => s.retryAllFailed);
  const clearFinished = useQueueStore((s) => s.clearFinished);

  const count = (...statuses: QueueStatus[]) => items.filter((i) => statuses.includes(i.status)).length;
  const active = count(QueueStatus.Downloading, QueueStatus.Merging);
  const waiting = count(QueueStatus.Queued, QueueStatus.Paused);
  const done = count(QueueStatus.Done);
  const failed = count(QueueStatus.Error);
  const finished = count(QueueStatus.Done, QueueStatus.Canceled);
  const errors = count(QueueStatus.Error, QueueStatus.Canceled);

  const subtitle = items.length
    ? t(
        `${active} activas · ${waiting} en espera · ${done} completadas`,
        `${active} active · ${waiting} waiting · ${done} completed`,
      )
    : t('Nada en la cola.', 'Nothing in the queue.');

  return (
    <Box className="mx-auto w-full max-w-[1020px] px-7.5 pt-6.5 pb-16">
      <style>{BARFLOW_CSS}</style>
      <Stack direction="row" align="end" justify="between" gap="md" className="mb-5">
        <Box>
          <H1 className="text-[25px] tracking-[-.5px]">{t('Cola de descargas', 'Download queue')}</H1>
          <P color="muted" className="mt-1.25 text-[13.5px]">
            {subtitle}
          </P>
        </Box>
        <Stack direction="row" align="center" gap="none" className="gap-2.25">
          {finished > 0 && (
            <button
              type="button"
              onClick={clearFinished}
              className="flex h-9 items-center gap-1.75 rounded-[9px] border border-border2 px-3.25 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <CheckIcon className="size-4" />
              {t('Limpiar terminados', 'Clear finished')}
            </button>
          )}
          {failed > 0 && (
            <button
              type="button"
              onClick={retryAllFailed}
              className="flex h-9 items-center gap-1.75 rounded-[9px] border border-border2 px-3.25 text-[12.5px] font-semibold text-destructive transition-colors hover:bg-accent"
            >
              <RotateCcwIcon className="size-4" />
              {t('Reintentar fallidos', 'Retry failed')}
            </button>
          )}
        </Stack>
      </Stack>

      {items.length > 0 && (
        <Box className="mb-4.5">
          <QueueStats active={active} waiting={waiting} done={done} errors={errors} />
        </Box>
      )}

      {items.length > 0 && (
        <Stack gap="none" className="gap-2.5">
          {items.map((it) => (
            <QueueItemCard key={it.id} item={it} onAction={action} onMove={move} />
          ))}
        </Stack>
      )}

      {items.length === 0 && <QueueEmpty />}
    </Box>
  );
};
