use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoMeta {
    pub id: String,
    pub url: String,
    pub title: String,
    pub channel: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub view_count: Option<u64>,
    /// public | unlisted | private | premium_only | subscriber_only | needs_auth | error | ...
    #[serde(skip_serializing_if = "Option::is_none")]
    pub availability: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,
    /// Nº de videos si la entrada plana es una playlist (feed de playlists) y yt-dlp lo reporta.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub playlist_count: Option<u64>,
    /// true si el metadato es "plano" (entrada de playlist sin resolver a fondo)
    pub flat: bool,
    pub is_playlist: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistMeta {
    pub id: String,
    pub url: String,
    pub title: String,
    pub channel: String,
    pub count: usize,
    pub entries: Vec<VideoMeta>,
    pub is_playlist: bool,
}

/// Resultado de analizar una URL: video suelto o playlist/canal.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AnalyzedEntry {
    Playlist(PlaylistMeta),
    Video(VideoMeta),
}
