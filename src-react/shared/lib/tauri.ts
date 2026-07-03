/** Typed Tauri boundary for the React app.
 * Minimal duplicate of src/core/tauri/client.ts: importing across app roots would
 * couple both tsconfig/eslint projects during the migration; the wrapper is 10 lines. */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export { invoke };
export type { UnlistenFn };

/** Subscribes to a backend event and delivers the payload directly. */
export function onEvent<T>(name: string, cb: (payload: T) => void): Promise<UnlistenFn> {
  return listen<T>(name, (e) => cb(e.payload));
}
