export interface DownloadResult {
  success: boolean;
  error?: string;
  /** Failure classification: session/cookies ("auth"), persistent 403 ("cache"), or other. */
  errorKind?: 'auth' | 'cache' | 'other';
  /** Absolute path of the final downloaded file (if it could be captured). */
  filePath?: string;
}

export interface ProgressData {
  percent: number;
  speed: string;
  eta: string;
  /** Rust only emits these two states; the end (success/error) is inferred from start_download's result. */
  status: 'downloading' | 'processing';
  url: string;
}

export interface DownloadOptions {
  mode: 'video' | 'videoonly' | 'audio';
  quality: string; // auto | max | 2160 | 1440 | 1080 | 720 | 480 | 360
  container: 'mp4' | 'mkv' | 'webm';
  audioFormat: 'mp3' | 'm4a' | 'opus';
  audioBitrate: number; // kbps (0 = auto)
  subtitles: boolean;
  subLangs: string;
  embedThumbnail: boolean;
  outputTemplate?: string;
  cookieMode: string; // file | none
}
