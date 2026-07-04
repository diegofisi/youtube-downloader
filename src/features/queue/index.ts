// Public facade of the queue slice — other features/shared import ONLY from here.
// Pinned contract: enqueue is usable as `useQueueStore.getState().enqueue(items)`.
// Pages are NOT exported: the router lazy-loads them by path to keep chunks split.
export { useQueueStore, selectActiveCount } from './stores/useQueueStore';
export { QueueBridge } from './components/QueueBridge';
export { QueueStatus, type EnqueueItem, type QueueItem } from './models/queue-item.model';
export type { DownloadOptions } from './models/download-options.model';
