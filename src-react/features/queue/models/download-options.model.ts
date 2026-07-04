/** Local mirror of the download feature's DownloadOptions (guideline §4.15: no
 * cross-feature imports — the queue carries the options opaquely to start_download). */
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
