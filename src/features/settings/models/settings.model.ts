export const DownloadMode = {
  Video: 'video',
  Audio: 'audio',
} as const;
export type DownloadMode = (typeof DownloadMode)[keyof typeof DownloadMode];

export const Container = {
  Mp4: 'mp4',
  Mkv: 'mkv',
  Webm: 'webm',
} as const;
export type Container = (typeof Container)[keyof typeof Container];

export interface Settings {
  downloadFolder: string;
  defaultQuality: string;
  defaultContainer: Container;
  defaultAudioFormat: string;
  defaultConcurrency: number;
  defaultMode: DownloadMode;
  /** Without the ".%(ext)s" suffix. */
  defaultTemplate: string;
  defaultSubtitles: boolean;
  defaultThumbnail: boolean;
  clearLinksAfterPreview: boolean;
}

/** What set_settings persists — the folder has its own picker flow. */
export type SettingsUpdate = Omit<Settings, 'downloadFolder'>;
