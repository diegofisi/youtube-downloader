import { CheckIcon, RotateCcwIcon } from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
import { QueueStatus } from '../models/queue-item.model';
import { useQueueStore } from '../stores/useQueueStore';
import { QueueStats } from '../components/QueueStats';
import { QueueItemCard } from '../components/QueueItemCard';
import { QueueEmpty } from '../components/QueueEmpty';

const BARFLOW_CSS = '@keyframes barflow{from{background-position:0 0}to{background-position:28px 0}}';

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
    ? t.queue.subtitle({ active, waiting, done })
    : t.queue.noneQueued();

  return (
    <Box className="mx-auto w-full max-w-255 px-7.5 pt-6.5 pb-16">
      <style>{BARFLOW_CSS}</style>
      <Stack direction="row" align="end" justify="between" gap="md" className="mb-5">
        <Box>
          <Text variant="h1">{t.queue.title()}</Text>
          <Text variant="body-sm" color="muted" className="mt-1.25">
            {subtitle}
          </Text>
        </Box>
        <Stack direction="row" align="center" gap="none" className="gap-2.25">
          {finished > 0 && (
            <button
              type="button"
              onClick={clearFinished}
              className="flex h-9 items-center gap-1.75 rounded-[9px] border border-border2 px-3.25 text-small font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <CheckIcon className="size-4" />
              {t.queue.clearFinished()}
            </button>
          )}
          {failed > 0 && (
            <button
              type="button"
              onClick={retryAllFailed}
              className="flex h-9 items-center gap-1.75 rounded-[9px] border border-border2 px-3.25 text-small font-semibold text-destructive transition-colors hover:bg-accent"
            >
              <RotateCcwIcon className="size-4" />
              {t.queue.retryFailed()}
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
