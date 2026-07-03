//! Persistent app configuration model (config.json).
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
    /// Output template (without ".%(ext)s").
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

#[cfg(test)]
mod tests {
    use super::*;

    // Backward-compat contract: an old config.json (missing later-added fields)
    // must deserialize with the serde defaults, never fail.

    #[test]
    fn config_json_vacio_deserializa_con_todos_los_defaults() {
        let cfg: AppConfig = serde_json::from_str("{}").unwrap();
        assert_eq!(cfg.download_folder, "");
        assert_eq!(cfg.default_quality, "auto");
        assert_eq!(cfg.default_container, "mp4");
        assert_eq!(cfg.default_audio_format, "mp3");
        assert_eq!(cfg.default_concurrency, 5);
        assert_eq!(cfg.default_mode, "video");
        assert_eq!(cfg.default_template, "%(title)s [%(id)s]");
        assert!(!cfg.default_subtitles);
        assert!(cfg.default_thumbnail);
        assert!(cfg.clear_links_after_preview);
    }

    #[test]
    fn config_json_viejo_conserva_lo_suyo_y_rellena_los_campos_nuevos() {
        // First-version format: only folder, quality, container, audio and
        // concurrency (no mode/template/subs/thumbnail/clear_links).
        let viejo = r#"{
            "download_folder": "C:\\Descargas",
            "default_quality": "1080",
            "default_container": "mkv",
            "default_audio_format": "m4a",
            "default_concurrency": 2
        }"#;
        let cfg: AppConfig = serde_json::from_str(viejo).unwrap();
        assert_eq!(cfg.download_folder, "C:\\Descargas");
        assert_eq!(cfg.default_quality, "1080");
        assert_eq!(cfg.default_container, "mkv");
        assert_eq!(cfg.default_audio_format, "m4a");
        assert_eq!(cfg.default_concurrency, 2);
        // New fields → defaults.
        assert_eq!(cfg.default_mode, "video");
        assert_eq!(cfg.default_template, "%(title)s [%(id)s]");
        assert!(!cfg.default_subtitles);
        assert!(cfg.default_thumbnail);
        assert!(cfg.clear_links_after_preview);
    }

    #[test]
    fn el_default_de_rust_y_el_de_serde_coinciden() {
        // Catches a default changed in one place but not the other.
        let por_serde: AppConfig = serde_json::from_str("{}").unwrap();
        let por_rust = AppConfig::default();
        assert_eq!(
            serde_json::to_value(&por_serde).unwrap(),
            serde_json::to_value(&por_rust).unwrap()
        );
    }
}
