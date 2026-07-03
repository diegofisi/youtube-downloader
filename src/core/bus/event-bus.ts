// Typed in-app event bus. Decouples slices (breaks preview↔queue↔session cycles).
// Extend AppEvents as new domain events appear.
export interface AppEvents {
  // Payload-less events: typed `void` and emitted without a second argument.
  'session:expired': void;
  'session:connected': void;
  'session:changed': void;
  'theme:changed': void;
  'nav:changed': { view: string };
  'nav:goto': { view: string };
  'download:completed': { url: string; title: string; format: string; videoId?: string };
  'queue:count': { active: number };
  /** Prefills urls into the Download view and triggers analysis (the emitter navigates via nav:goto). */
  'descargar:prefill': { urls: string[] };
}

type Handler<K extends keyof AppEvents> = (payload: AppEvents[K]) => void;

/** `void` events emit without payload; the rest require their typed payload. */
type EmitArgs<K extends keyof AppEvents> = AppEvents[K] extends void ? [] : [payload: AppEvents[K]];

const handlers = new Map<keyof AppEvents, Set<(payload: never) => void>>();

export const bus = {
  on<K extends keyof AppEvents>(event: K, fn: Handler<K>): () => void {
    let set = handlers.get(event);
    if (!set) handlers.set(event, (set = new Set()));
    set.add(fn as (payload: never) => void);
    return () => set!.delete(fn as (payload: never) => void);
  },
  emit<K extends keyof AppEvents>(event: K, ...args: EmitArgs<K>): void {
    const payload = (args as unknown[])[0] as AppEvents[K];
    handlers.get(event)?.forEach((fn) => (fn as Handler<K>)(payload));
  },
};
