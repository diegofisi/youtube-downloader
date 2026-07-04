import { create } from 'zustand';

// Pinned contract (published via features/download/index.ts): Search / My YouTube call
// setUrls(urls) + navigate(AppPath.DESCARGAR); DescargarPage consumes and auto-analyzes.

interface DownloadPrefillStore {
  // State
  urls: string[];
  // Actions
  setUrls: (urls: string[]) => void;
  /** Returns the pending urls and clears them (idempotent when empty). */
  consume: () => string[];
}

export const useDownloadPrefill = create<DownloadPrefillStore>((set, get) => ({
  urls: [],
  setUrls: (urls) => set({ urls }),
  consume: () => {
    const urls = get().urls;
    if (urls.length > 0) set({ urls: [] });
    return urls;
  },
}));
