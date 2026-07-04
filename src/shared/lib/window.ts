/** Window controls (custom titlebar) — the other sanctioned @tauri-apps/api entry point. */
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
