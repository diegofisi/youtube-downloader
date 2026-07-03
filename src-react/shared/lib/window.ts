/** Window controls (custom titlebar). Duplicate of src/core/tauri/window.ts — see tauri.ts note. */
import { getCurrentWindow } from '@tauri-apps/api/window';

export function minimizeWindow(): Promise<void> {
  return getCurrentWindow().minimize();
}

export function toggleMaximizeWindow(): Promise<void> {
  return getCurrentWindow().toggleMaximize();
}

export function closeWindow(): Promise<void> {
  return getCurrentWindow().close();
}
