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

/// Reachability of one pinned download source, for the startup warning and Ajustes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceStatus {
    pub name: String,
    pub url: String,
    pub ok: bool,
    /// "HTTP 200", "HTTP 404" or the transport error text.
    pub detail: String,
}
