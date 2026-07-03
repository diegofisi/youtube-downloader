import type { SettingsUpdate } from '../../models/settings.model';
import type { SettingsDTOResponse } from '../get-settings/get-settings.dto';

/** set_settings takes camelCase args (Tauri command params) — mirrors the Rust command exactly. */
export interface SetSettingsDTORequest {
  defaultQuality: string;
  defaultContainer: string;
  defaultAudioFormat: string;
  defaultConcurrency: number;
  defaultMode: string;
  defaultTemplate: string;
  defaultSubtitles: boolean;
  defaultThumbnail: boolean;
  clearLinksAfterPreview: boolean;
}

export const toSetSettingsDTO = (model: SettingsUpdate): SetSettingsDTORequest => ({
  defaultQuality: model.defaultQuality,
  defaultContainer: model.defaultContainer,
  defaultAudioFormat: model.defaultAudioFormat,
  defaultConcurrency: model.defaultConcurrency,
  defaultMode: model.defaultMode,
  defaultTemplate: model.defaultTemplate,
  defaultSubtitles: model.defaultSubtitles,
  defaultThumbnail: model.defaultThumbnail,
  clearLinksAfterPreview: model.clearLinksAfterPreview,
});

/** Keeps the ['settings'] cache (snake_case DTO) in sync after a successful save. */
export const patchSettingsDTO = (old: SettingsDTOResponse, model: SettingsUpdate): SettingsDTOResponse => ({
  ...old,
  default_quality: model.defaultQuality,
  default_container: model.defaultContainer,
  default_audio_format: model.defaultAudioFormat,
  default_concurrency: model.defaultConcurrency,
  default_mode: model.defaultMode,
  default_template: model.defaultTemplate,
  default_subtitles: model.defaultSubtitles,
  default_thumbnail: model.defaultThumbnail,
  clear_links_after_preview: model.clearLinksAfterPreview,
});
