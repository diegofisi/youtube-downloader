/** Common Tauri client: typed invoke + event subscription. */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export { invoke };
export type { UnlistenFn };

/** Subscribes to a backend event and delivers the payload directly. */
export function onEvent<T>(name: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  return listen<T>(name, (e) => cb(e.payload));
}
