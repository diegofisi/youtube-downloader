import { invoke, onEvent, type UnlistenFn } from '../../core/tauri/client';
import type { DownloadOptions, DownloadResult, ProgressData } from './download.types';

export async function startDownload(url: string, options: DownloadOptions): Promise<DownloadResult> {
  return invoke<DownloadResult>('start_download', { url, options });
}

export async function cancelDownload(url?: string): Promise<void> {
  return invoke('cancel_download', { url: url ?? null });
}

export function onProgress(cb: (data: ProgressData) => void): Promise<UnlistenFn> {
  return onEvent<ProgressData>('download-progress', cb);
}
