use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

const CONFIG_FILE: &str = "config.json";

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

/// Actualiza los ajustes por defecto. Los parámetros `Option` solo se aplican
/// si llegan con valor (retro-compatible con llamadas que no los envían).
#[allow(clippy::too_many_arguments)]
pub fn set_defaults(
    app_dir: &Path,
    quality: String,
    container: String,
    audio_format: String,
    concurrency: u32,
    mode: Option<String>,
    template: Option<String>,
    subtitles: Option<bool>,
    thumbnail: Option<bool>,
    clear_links_after_preview: Option<bool>,
) -> Result<(), String> {
    let mut config = load(app_dir);
    config.default_quality = quality;
    config.default_container = container;
    config.default_audio_format = audio_format;
    config.default_concurrency = concurrency;
    if let Some(v) = mode {
        config.default_mode = v;
    }
    if let Some(v) = template {
        config.default_template = v;
    }
    if let Some(v) = subtitles {
        config.default_subtitles = v;
    }
    if let Some(v) = thumbnail {
        config.default_thumbnail = v;
    }
    if let Some(v) = clear_links_after_preview {
        config.clear_links_after_preview = v;
    }
    save(app_dir, &config)
}

fn config_path(app_dir: &Path) -> PathBuf {
    app_dir.join(CONFIG_FILE)
}

pub fn load(app_dir: &Path) -> AppConfig {
    let path = config_path(app_dir);
    if !path.exists() {
        return AppConfig::default();
    }
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn save(app_dir: &Path, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app_dir);
    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Error al serializar config: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("Error al guardar config: {}", e))
}

pub fn get_download_folder(app_dir: &Path) -> PathBuf {
    let config = load(app_dir);
    if config.download_folder.is_empty() {
        app_dir.join("videos_descargados")
    } else {
        PathBuf::from(&config.download_folder)
    }
}

pub fn set_download_folder(app_dir: &Path, folder: &str) -> Result<(), String> {
    let mut config = load(app_dir);
    config.download_folder = folder.to_string();
    save(app_dir, &config)
}
