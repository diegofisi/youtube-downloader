// Analysis result models (camelCase) — the only shapes the download UI consumes.

export interface AnalyzedVideo {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration?: number;
  thumbnail?: string;
  availability?: string;
  sizeBytes?: number;
  isPlaylist: false;
}

export interface AnalyzedPlaylist {
  id: string;
  url: string;
  title: string;
  channel: string;
  count: number;
  entries: AnalyzedVideo[];
  isPlaylist: true;
}

export type AnalyzedEntry = AnalyzedVideo | AnalyzedPlaylist;

/** Flattened video with cross-entry duplicate marking (same id already seen). */
export interface FlatVideo extends AnalyzedVideo {
  dup: boolean;
}
