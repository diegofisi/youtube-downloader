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
