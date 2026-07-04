// Download option state models (ports the vanilla opts-model state shapes).

export interface DownloadOpts {
  mode: 'av' | 'video' | 'audio';
  quality: string; // max|4k|1440p|1080p|720p|480p
  container: 'MP4' | 'MKV' | 'WebM';
  audioFmt: 'MP3' | 'M4A' | 'Opus';
  bitrate: string; // 128|192|256|320
  subs: boolean;
  thumb: boolean;
  template: string;
}

export type OptsOverride = Partial<DownloadOpts>;

export const DEFAULT_OPTS: DownloadOpts = {
  mode: 'av',
  quality: 'max',
  container: 'MP4',
  audioFmt: 'MP3',
  bitrate: '320',
  subs: false,
  thumb: true,
  template: '%(title)s [%(id)s]',
};

/** Backend DownloadOptions mirror — same shape the queue's EnqueueItem.options carries. */
export interface BackendDownloadOptions {
  mode: 'video' | 'videoonly' | 'audio';
  quality: string; // auto | max | 2160 | 1440 | 1080 | 720 | 480
  container: 'mp4' | 'mkv' | 'webm';
  audioFormat: 'mp3' | 'm4a' | 'opus';
  audioBitrate: number; // kbps (0 = auto)
  subtitles: boolean;
  subLangs: string;
  embedThumbnail: boolean;
  outputTemplate?: string;
  cookieMode: string; // file | none
}

/** Subset of the app settings that the download view consumes (§4.15 local model). */
export interface DownloadDefaults {
  quality: string;
  container: string;
  mode: string;
  template: string;
  subtitles: boolean;
  thumbnail: boolean;
  clearLinksAfterPreview: boolean;
}
