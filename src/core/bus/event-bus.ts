/**
 * Event bus in-app tipado. Desacopla slices: un slice emite y otros reaccionan
 * sin importarse entre sí. Corta ciclos preview↔queue↔session.
 *
 * Extiende AppEvents a medida que aparezcan eventos de dominio.
 */
export interface AppEvents {
  // Eventos sin payload: se tipan `void` y se emiten sin segundo argumento.
  'session:expired': void;
  'session:connected': void;
  'session:changed': void;
  'theme:changed': void;
  'nav:changed': { view: string };
  'nav:goto': { view: string };
  'download:completed': { url: string; title: string; format: string; videoId?: string };
  'queue:count': { active: number };
  /** Pre-carga urls en la vista Descargar y lanza el análisis (el emisor navega con nav:goto). */
  'descargar:prefill': { urls: string[] };
}

type Handler<K extends keyof AppEvents> = (payload: AppEvents[K]) => void;

/** Los eventos `void` se emiten sin payload; el resto exige su payload tipado. */
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
