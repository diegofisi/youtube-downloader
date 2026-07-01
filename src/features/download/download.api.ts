import { invoke, onEvent, type UnlistenFn } from '../../core/tauri/client';
import type { DownloadResult, ProgressData } from './download.types';

export async function startDownload(url: string, cookieMode: string): Promise<DownloadResult> {
  return invoke<DownloadResult>('start_download', { url, cookieMode });
}

export async function cancelDownload(url?: string): Promise<void> {
  return invoke('cancel_download', { url: url ?? null });
}

export function onProgress(cb: (data: ProgressData) => void): Promise<UnlistenFn> {
  return onEvent<ProgressData>('download-progress', cb);
}
