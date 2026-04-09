import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import type { CookieResult, DependencyStatus, DownloadResult, ProgressData, SetupProgress } from '../types';

export async function checkCookies(): Promise<CookieResult> {
  return invoke<CookieResult>('check_cookies');
}

export async function loadCookies(): Promise<CookieResult> {
  const selected = await open({
    title: 'Selecciona tu archivo cookies.txt',
    filters: [
      { name: 'Cookies', extensions: ['txt'] },
      { name: 'Todos', extensions: ['*'] },
    ],
  });

  if (!selected) {
    return { status: 'cancelled' };
  }

  const filePath = typeof selected === 'string' ? selected : (selected as any).path;
  return invoke<CookieResult>('load_cookies', { path: filePath });
}

export async function startDownload(url: string, cookieMode: string): Promise<DownloadResult> {
  return invoke<DownloadResult>('start_download', { url, cookieMode });
}

export async function cancelDownload(url?: string): Promise<void> {
  return invoke('cancel_download', { url: url ?? null });
}

export async function openDownloadsFolder(): Promise<void> {
  return invoke('open_downloads_folder');
}

export async function getDownloadFolder(): Promise<string> {
  return invoke<string>('get_download_folder');
}

export async function changeDownloadFolder(): Promise<string | null> {
  const selected = await open({
    title: 'Selecciona la carpeta de descargas',
    directory: true,
  });

  if (!selected) return null;

  const folderPath = typeof selected === 'string' ? selected : (selected as any).path;
  return invoke<string>('set_download_folder', { folder: folderPath });
}

export async function openUrl(url: string): Promise<void> {
  await shellOpen(url);
}

export function onProgress(callback: (data: ProgressData) => void): Promise<UnlistenFn> {
  return listen<ProgressData>('download-progress', (event) => {
    callback(event.payload);
  });
}

// Setup / Dependencies
export async function checkDependencies(): Promise<DependencyStatus> {
  return invoke<DependencyStatus>('check_dependencies');
}

export async function downloadDependencies(): Promise<void> {
  return invoke('download_dependencies');
}

export function onSetupProgress(callback: (data: SetupProgress) => void): Promise<UnlistenFn> {
  return listen<SetupProgress>('setup-progress', (event) => {
    callback(event.payload);
  });
}
