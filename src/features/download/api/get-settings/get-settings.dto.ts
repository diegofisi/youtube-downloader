import type { DownloadDefaults } from '../../models/download-opts.model';

// Minimal mirror of Rust AppConfig (snake_case): only the fields this view needs.
export interface DownloadSettingsDTOResponse {
  default_quality: string;
  default_container: string;
  default_mode: string;
  default_template: string;
  default_subtitles: boolean;
  default_thumbnail: boolean;
  clear_links_after_preview: boolean;
}

export const toDownloadDefaults = (dto: DownloadSettingsDTOResponse): DownloadDefaults => ({
  quality: dto.default_quality,
  container: dto.default_container,
  mode: dto.default_mode,
  template: dto.default_template,
  subtitles: dto.default_subtitles,
  thumbnail: dto.default_thumbnail,
  clearLinksAfterPreview: dto.clear_links_after_preview,
});
