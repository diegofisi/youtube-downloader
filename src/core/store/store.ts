/**
 * Store observable mínimo (sin framework).
 * Cada `model/*.store.ts` de un slice crea uno. Notificación síncrona.
 */
export type Unsubscribe = () => void;

export interface Store<T> {
  get(): T;
  set(next: Partial<T> | ((prev: T) => T)): void;
  subscribe(fn: (state: T) => void): Unsubscribe;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<(s: T) => void>();

  return {
    get: () => state,
    set(next) {
      const patch = typeof next === 'function' ? (next as (p: T) => T)(state) : next;
      state = { ...state, ...patch };
      for (const fn of subs) fn(state);
    },
    subscribe(fn) {
      subs.add(fn);
      fn(state);
      return () => subs.delete(fn);
    },
  };
}
