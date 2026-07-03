import { invoke, onEvent, type UnlistenFn } from '../../core/tauri/client';
import type { AnalyzedEntry } from './preview.types';

/** 1-based (inclusive) range for paging playlists/feeds: translates to --playlist-items. */
export interface AnalyzeRange {
  start: number;
  end: number;
}

export async function analyzeUrls(urls: string[], range?: AnalyzeRange): Promise<AnalyzedEntry[]> {
  return invoke<AnalyzedEntry[]>('analyze_urls', { urls, start: range?.start, end: range?.end });
}

export function onPreviewProgress(cb: (done: number, total: number) => void): Promise<UnlistenFn> {
  return onEvent<[number, number]>('preview-progress', ([done, total]) => cb(done, total));
}
