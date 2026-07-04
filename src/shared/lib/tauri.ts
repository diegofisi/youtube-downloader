// Only module (window.ts aside) allowed to touch @tauri-apps/api directly;
// consumed exclusively by api/ and stores/ layers (ESLint-enforced).
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export { invoke };
export type { UnlistenFn };

export function onEvent<T>(name: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  return listen<T>(name, (e) => cb(e.payload));
}
