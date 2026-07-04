import {
  ChevronDownIcon,
  ChevronUpIcon,
  FolderOpenIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { Box } from '@/shared/components/layout/Box';
import { Stack } from '@/shared/components/layout/Stack';
import { Text } from '@/shared/components/ui/typography';
import { t } from '@/shared/lib/messages/t';
import { QueueStatus, type QueueItem, type QueueItemAction } from '../models/queue-item.model';
import { getQueueStatusMeta } from '../helpers/queue-status-meta';
import { QueueActionButton } from './QueueActionButton';

interface ActionDef {
  act: QueueItemAction;
  title: string;
  icon: LucideIcon;
  danger?: boolean;
}

interface QueueItemCardProps {
  item: QueueItem;
  onAction: (id: string, act: QueueItemAction) => void;
  onMove: (id: string, dir: number) => void;
}

function getItemView(item: QueueItem): { detail: string; detailColor: string; actions: ActionDef[] } {
  if (item.status === QueueStatus.Downloading) {
    const detail =
      [item.speed, item.eta ? `ETA ${item.eta}` : ''].filter(Boolean).join(' · ') || `${item.progress.toFixed(0)}%`;
    return {
      detail,
      detailColor: 'var(--text2)',
      actions: [
        { act: 'pause', title: t.queue.pause(), icon: PauseIcon },
        { act: 'cancel', title: t.common.cancel(), icon: XIcon, danger: true },
      ],
    };
  }
  if (item.status === QueueStatus.Merging) {
    return {
      detail: t.queue.merging(),
      detailColor: 'var(--text2)',
      actions: [{ act: 'cancel', title: t.common.cancel(), icon: XIcon, danger: true }],
    };
  }
  if (item.status === QueueStatus.Queued) {
    return {
      detail: t.queue.waiting(),
      detailColor: 'var(--text2)',
      actions: [{ act: 'remove', title: t.queue.remove(), icon: XIcon }],
    };
  }
  if (item.status === QueueStatus.Paused) {
    return {
      detail: t.queue.paused(),
      detailColor: 'var(--text2)',
      actions: [
        { act: 'resume', title: t.queue.resume(), icon: PlayIcon },
        { act: 'cancel', title: t.common.cancel(), icon: XIcon, danger: true },
      ],
    };
  }
  if (item.status === QueueStatus.Done) {
    return {
      detail: t.common.ready(),
      detailColor: 'var(--success)',
      actions: [
        { act: 'folder', title: t.common.openFolder(), icon: FolderOpenIcon },
        { act: 'remove', title: t.common.removeFromList(), icon: XIcon },
      ],
    };
  }
  // error | canceled
  return {
    detail: item.status === QueueStatus.Error ? 'Error' : t.queue.canceled(),
    detailColor: 'var(--danger)',
    actions: [
      { act: 'retry', title: t.common.retry(), icon: RotateCcwIcon },
      { act: 'remove', title: t.common.removeFromList(), icon: Trash2Icon },
    ],
  };
}

const STRIPES =
  'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%)';

export const QueueItemCard = ({ item, onAction, onMove }: QueueItemCardProps) => {
  const meta = getQueueStatusMeta(item.status);
  const { detail, detailColor, actions } = getItemView(item);
  const barPercent = item.status === QueueStatus.Done || item.status === QueueStatus.Merging ? 100 : item.progress;
  const animated = item.status === QueueStatus.Downloading;

  return (
    <Box className="rounded-[14px] border border-border bg-panel px-3.25 py-3">
      <Stack direction="row" align="center" gap="none" className="gap-3.25">
        <Stack gap="none" className="-mr-1 flex-none gap-0.5">
          <button
            type="button"
            title={t.queue.moveUp()}
            onClick={() => onMove(item.id, -1)}
            className="flex h-4.5 w-5.5 items-center justify-center rounded-[5px] text-faint hover:bg-accent hover:text-foreground"
          >
            <ChevronUpIcon className="size-3.25" />
          </button>
          <button
            type="button"
            title={t.queue.moveDown()}
            onClick={() => onMove(item.id, 1)}
            className="flex h-4.5 w-5.5 items-center justify-center rounded-[5px] text-faint hover:bg-accent hover:text-foreground"
          >
            <ChevronDownIcon className="size-3.25" />
          </button>
        </Stack>

        <Box className="relative h-15 w-26 flex-none overflow-hidden rounded-[9px]" style={{ background: item.grad }}>
          {item.thumbnail && <img src={item.thumbnail} alt="" className="size-full object-cover" />}
          {!item.thumbnail && (
            <Text variant="inline" className="absolute inset-0 flex items-center justify-center text-white opacity-85">
              <PlayIcon className="size-5" fill="currentColor" />
            </Text>
          )}
        </Box>

        <Box className="min-w-0 flex-1">
          <Stack direction="row" align="center" gap="none" className="mb-0.75 gap-2.25">
            <Text variant="body-sm" weight="semibold" className="truncate">
              {item.title}
            </Text>
            <Text variant="caption"
              weight="semibold"
              className="inline-flex flex-none items-center rounded-[7px] px-2 py-0.5"
              style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 15%, transparent)` }}
            >
              {meta.label}
            </Text>
          </Stack>
          <Box className="mb-2 truncate text-xs text-muted-foreground">
            {[item.channel, item.fmt].filter(Boolean).join(' · ')}
          </Box>
          <Stack direction="row" align="center" gap="none" className="gap-2.75">
            <Box className="h-1.5 flex-1 overflow-hidden rounded" style={{ background: 'var(--hover)' }}>
              <Box
                className="h-full rounded transition-[width] duration-300"
                style={{
                  width: `${barPercent}%`,
                  background: meta.color,
                  ...(animated
                    ? {
                        backgroundImage: STRIPES,
                        backgroundSize: '28px 28px',
                        animation: 'barflow .8s linear infinite',
                      }
                    : {}),
                }}
              />
            </Box>
            <Text variant="caption" className="font-mono whitespace-nowrap" style={{ color: detailColor }}>
              {detail}
            </Text>
          </Stack>
        </Box>

        <Stack direction="row" align="center" gap="xs" className="flex-none">
          {actions.map(({ act, title, icon: Icon, danger }) => (
            <QueueActionButton key={act} title={title} danger={danger} onClick={() => onAction(item.id, act)}>
              <Icon className="size-4" />
            </QueueActionButton>
          ))}
        </Stack>
      </Stack>

      {item.error && (
        <Stack
          direction="row"
          align="center"
          gap="sm"
          className="mt-2.5 rounded-[9px] bg-destructive-soft px-3 py-2.25 text-xs text-destructive"
        >
          <TriangleAlertIcon className="size-4 flex-none" />
          {item.error}
        </Stack>
      )}
    </Box>
  );
};
