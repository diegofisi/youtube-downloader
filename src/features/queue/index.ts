// Fachada pública del slice queue: idéntica a la previa al refactor de Fase 3
// (enqueue, setConcurrency, initQueueView, EnqueueItem). La lógica vive en
// queue.state.ts (sin DOM) y el render en ui/queue-view.ts.
export { enqueue, setConcurrency } from './queue.state';
export type { EnqueueItem } from './queue.state';
export { initQueueView } from './ui/queue-view';
