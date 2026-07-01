import { invoke, onEvent, type UnlistenFn } from '../../core/tauri/client';
import type { AnalyzedEntry } from './preview.types';

export async function analyzeUrls(urls: string[]): Promise<AnalyzedEntry[]> {
  return invoke<AnalyzedEntry[]>('analyze_urls', { urls });
}

export function onPreviewProgress(cb: (done: number, total: number) => void): Promise<UnlistenFn> {
  return onEvent<[number, number]>('preview-progress', ([done, total]) => cb(done, total));
}
