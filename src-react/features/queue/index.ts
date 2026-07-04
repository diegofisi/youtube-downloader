// Public facade of the queue slice — other features/shared import ONLY from here.
// Pinned contract: enqueue is usable as `useQueueStore.getState().enqueue(items)`.
export { useQueueStore, selectActiveCount } from './stores/useQueueStore';
export { QueueBridge } from './components/QueueBridge';
export { ColaPage } from './pages/ColaPage';
export { QueueStatus, type EnqueueItem, type QueueItem } from './models/queue-item.model';
export type { DownloadOptions } from './models/download-options.model';
