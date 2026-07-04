export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
  /** Rust only emits these two; the end (success/error) comes from start_download's result. */
  status: 'downloading' | 'processing';
  url: string;
}
