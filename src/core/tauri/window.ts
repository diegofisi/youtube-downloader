/** Window controls (custom titlebar). */
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

export function minimizeWindow(): Promise<void> {
  return appWindow.minimize();
}

export function toggleMaximizeWindow(): Promise<void> {
  return appWindow.toggleMaximize();
}

export function closeWindow(): Promise<void> {
  return appWindow.close();
}
