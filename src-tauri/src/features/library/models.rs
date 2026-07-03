use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryEntry {
    pub id: String,
    /// Id del video (p. ej. id de YouTube), independiente de la URL exacta.
    #[serde(default, rename = "videoId", skip_serializing_if = "Option::is_none")]
    pub video_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    /// Duración en segundos.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    /// Ruta absoluta del archivo descargado (si se pudo capturar).
    #[serde(default, rename = "filePath", skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    pub url: String,
    pub title: String,
    pub format: String,
    pub folder: String,
    /// Unix timestamp en segundos.
    pub date: u64,
}
