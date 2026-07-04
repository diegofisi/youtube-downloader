/** Domain model for a finished download in the history. */
export interface LibraryEntry {
  id: string;
  /** Video id (e.g. YouTube id), independent of the exact URL. */
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
