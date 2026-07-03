use serde::{Deserialize, Serialize};

/// Data for a new history entry (groups the creation params to avoid
/// too-many-args signatures; see `service::add`).
#[derive(Debug, Clone)]
pub struct NewEntry {
    pub url: String,
    pub title: String,
    pub format: String,
    pub video_id: Option<String>,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryEntry {
    pub id: String,
    /// Video id (e.g. YouTube id), independent of the exact URL.
    #[serde(default, rename = "videoId", skip_serializing_if = "Option::is_none")]
    pub video_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    /// Duration in seconds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    /// Absolute path of the downloaded file (if captured).
    #[serde(default, rename = "filePath", skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    pub url: String,
    pub title: String,
    pub format: String,
    pub folder: String,
    /// Unix timestamp in seconds.
    pub date: u64,
}
