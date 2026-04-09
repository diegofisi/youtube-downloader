use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub ytdlp: bool,
    pub ffmpeg: bool,
    pub deno: bool,
    pub ready: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupProgress {
    pub step: String,
    pub percent: f64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CookieResult {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressData {
    pub percent: f64,
    pub speed: String,
    pub eta: String,
    pub status: String,
    pub url: String,
}

impl CookieResult {
    pub fn new(status: &str) -> Self {
        Self {
            status: status.to_string(),
            path: None,
            message: None,
        }
    }

    pub fn with_path(mut self, path: &str) -> Self {
        self.path = Some(path.to_string());
        self
    }
}
