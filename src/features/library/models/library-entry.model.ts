export interface LibraryEntry {
  id: string;
  /** Independent of the exact URL, so re-downloads of the same video match. */
  videoId?: string;
  thumbnail?: string;
  /** Duration in seconds. */
  duration?: number;
  /** Absolute path of the downloaded file (if it could be captured). */
  filePath?: string;
  url: string;
  title: string;
  format: string;
  folder: string;
  date: Date;
}
