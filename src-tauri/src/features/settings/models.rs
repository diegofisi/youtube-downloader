//! Modelo de configuración persistente de la app (config.json).
use serde::{Deserialize, Serialize};

fn default_quality() -> String {
    "auto".into()
}
fn default_container() -> String {
    "mp4".into()
}
fn default_audio_format() -> String {
    "mp3".into()
}
fn default_concurrency() -> u32 {
    5
}
fn default_mode() -> String {
    "video".into()
}
fn default_template() -> String {
    "%(title)s [%(id)s]".into()
}
fn default_subtitles() -> bool {
    false
}
fn default_thumbnail() -> bool {
    true
}
fn default_clear_links_after_preview() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub download_folder: String,
    #[serde(default = "default_quality")]
    pub default_quality: String,
    #[serde(default = "default_container")]
    pub default_container: String,
    #[serde(default = "default_audio_format")]
    pub default_audio_format: String,
    #[serde(default = "default_concurrency")]
    pub default_concurrency: u32,
    /// "video" | "audio"
    #[serde(default = "default_mode")]
    pub default_mode: String,
    /// Plantilla de salida (sin ".%(ext)s").
    #[serde(default = "default_template")]
    pub default_template: String,
    #[serde(default = "default_subtitles")]
    pub default_subtitles: bool,
    #[serde(default = "default_thumbnail")]
    pub default_thumbnail: bool,
    #[serde(default = "default_clear_links_after_preview")]
    pub clear_links_after_preview: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            download_folder: String::new(),
            default_quality: default_quality(),
            default_container: default_container(),
            default_audio_format: default_audio_format(),
            default_concurrency: default_concurrency(),
            default_mode: default_mode(),
            default_template: default_template(),
            default_subtitles: default_subtitles(),
            default_thumbnail: default_thumbnail(),
            clear_links_after_preview: default_clear_links_after_preview(),
        }
    }
}
