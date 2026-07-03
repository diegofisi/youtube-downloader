export interface DownloadResult {
  success: boolean;
  error?: string;
  /** Clasificación del fallo: sesión/cookies ("auth"), 403 persistente ("cache") u otro. */
  errorKind?: 'auth' | 'cache' | 'other';
  /** Ruta absoluta del archivo final descargado (si se pudo capturar). */
  filePath?: string;
}

export interface ProgressData {
  percent: number;
  speed: string;
  eta: string;
  /** Rust solo emite estos dos estados; el fin (éxito/error) se infiere del resultado de start_download. */
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
