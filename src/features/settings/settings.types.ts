export interface AppConfig {
  download_folder: string;
  default_quality: string;
  default_container: string;
  default_audio_format: string;
  default_concurrency: number;
  /** "video" | "audio" */
  default_mode: string;
  /** Plantilla de salida (sin ".%(ext)s"). */
  default_template: string;
  default_subtitles: boolean;
  default_thumbnail: boolean;
  clear_links_after_preview: boolean;
}
