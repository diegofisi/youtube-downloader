import { t } from '@/shared/lib/messages/t';
import { QueueStatus } from '../models/queue-item.model';

export interface QueueStatusMeta {
  label: string;
  /** CSS var reference so the palette stays light/dark aware. */
  color: string;
}

/** Function, not a constant: labels must re-evaluate t() on every render for a
 * live language switch. */
export function getQueueStatusMeta(status: QueueStatus): QueueStatusMeta {
  const map: Record<QueueStatus, QueueStatusMeta> = {
    [QueueStatus.Downloading]: { label: t.queue.statusDownloading(), color: 'var(--accent)' },
    [QueueStatus.Merging]: { label: t.queue.statusProcessing(), color: 'var(--info)' },
    [QueueStatus.Queued]: { label: t.queue.statusQueued(), color: 'var(--text2)' },
    [QueueStatus.Paused]: { label: t.queue.paused(), color: 'var(--warn)' },
    [QueueStatus.Done]: { label: t.queue.statusDone(), color: 'var(--success)' },
    [QueueStatus.Error]: { label: t.common.error(), color: 'var(--danger)' },
    [QueueStatus.Canceled]: { label: t.queue.canceled(), color: 'var(--text3)' },
  };
  return map[status];
}
