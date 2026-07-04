import { Container, DownloadMode, type Settings } from '../../models/settings.model';

/** Mirror of Rust `AppConfig` (legacy struct — serializes snake_case; copy reality, don't "fix" it here). */
export interface SettingsDTOResponse {
  download_folder: string;
  default_quality: string;
  default_container: string;
  default_audio_format: string;
  default_concurrency: number;
  default_mode: string;
  default_template: string;
  default_subtitles: boolean;
  default_thumbnail: boolean;
  clear_links_after_preview: boolean;
}

const toContainer = (raw: string): Container => {
  const v = (raw || Container.Mp4).toLowerCase();
  if (v === Container.Mkv) return Container.Mkv;
  if (v === Container.Webm) return Container.Webm;
  return Container.Mp4;
};

/** Same defensive fallbacks the vanilla settings-view applied on init. */
export const toSettings = (dto: SettingsDTOResponse): Settings => ({
  downloadFolder: dto.download_folder,
  defaultQuality: dto.default_quality || 'auto',
  defaultContainer: toContainer(dto.default_container),
  defaultAudioFormat: dto.default_audio_format || 'mp3',
  defaultConcurrency: dto.default_concurrency ?? 5,
  defaultMode: dto.default_mode === DownloadMode.Audio ? DownloadMode.Audio : DownloadMode.Video,
  defaultTemplate: dto.default_template ?? '%(title)s [%(id)s]',
  defaultSubtitles: dto.default_subtitles ?? false,
  defaultThumbnail: dto.default_thumbnail ?? true,
  clearLinksAfterPreview: dto.clear_links_after_preview ?? true,
});
