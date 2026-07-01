export interface DownloadResult {
  success: boolean;
  error?: string;
}

export interface ProgressData {
  percent: number;
  speed: string;
  eta: string;
  status: 'downloading' | 'processing' | 'finished' | 'error';
  url: string;
}
