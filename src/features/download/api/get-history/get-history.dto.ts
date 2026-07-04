// Minimal mirror of the history entry — only the keys the download view needs.
export interface HistoryEntryDTOResponse {
  url: string;
  videoId?: string;
}

/** "Already downloaded" matches by URL and by video id (URL may change form). */
export const toDownloadedKeys = (list: HistoryEntryDTOResponse[]): Set<string> =>
  new Set(list.flatMap((h) => (h.videoId ? [h.url, h.videoId] : [h.url])));
