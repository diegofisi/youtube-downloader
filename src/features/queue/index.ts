// Public facade of the queue slice (unchanged by the refactor). Logic lives in
// queue.state.ts (no DOM) and rendering in ui/queue-view.ts.
export { enqueue, setConcurrency } from './queue.state';
export type { EnqueueItem } from './queue.state';
export { initQueueView } from './ui/queue-view';
