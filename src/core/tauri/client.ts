/** Cliente Tauri común: invoke tipado + suscripción a eventos. */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export { invoke };
export type { UnlistenFn };

/** Suscribe a un evento del backend y entrega el payload directamente. */
export function onEvent<T>(name: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  return listen<T>(name, (e) => cb(e.payload));
}
