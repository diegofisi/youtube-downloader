use tauri::{AppHandle, Emitter};

use super::models::{AnalyzedEntry, VideoMeta};
use super::service;
use crate::core::paths;

/// Analiza un lote de URLs y devuelve preview (video suelto o playlist).
/// Emite `preview-progress` {done, total} durante el análisis.
/// `start`/`end` (opcionales, 1-based) paginan playlists/feeds con `--playlist-items`.
#[tauri::command]
pub async fn analyze_urls(
    app: AppHandle,
    urls: Vec<String>,
    start: Option<u32>,
    end: Option<u32>,
) -> Result<Vec<AnalyzedEntry>, String> {
    let app_dir = paths::app_dir(&app);
    let range = match (start, end) {
        (Some(s), Some(e)) if s >= 1 && e >= s => Some((s, e)),
        _ => None,
    };

    tauri::async_runtime::spawn_blocking(move || {
        let total = urls.len();
        let mut out: Vec<AnalyzedEntry> = Vec::with_capacity(total);

        for (i, url) in urls.iter().enumerate() {
            let entry = match service::analyze(&app_dir, url, range) {
                Ok(e) => e,
                Err(msg) => AnalyzedEntry::Video(VideoMeta {
                    id: String::new(),
                    url: url.clone(),
                    title: url.clone(),
                    channel: String::new(),
                    duration: None,
                    thumbnail: None,
                    view_count: None,
                    availability: Some(format!("error: {}", msg)),
                    size_bytes: None,
                    playlist_count: None,
                    flat: false,
                    is_playlist: false,
                }),
            };
            out.push(entry);
            let _ = app.emit("preview-progress", (i + 1, total));
        }

        out
    })
    .await
    .map_err(|e| format!("Error interno analizando URLs: {}", e))
}

/// Metadatos completos de un solo video (para resolución bajo demanda).
#[tauri::command]
pub async fn get_video_metadata(app: AppHandle, url: String) -> Result<AnalyzedEntry, String> {
    let app_dir = paths::app_dir(&app);
    tauri::async_runtime::spawn_blocking(move || service::analyze(&app_dir, &url, None))
        .await
        .map_err(|e| format!("Error interno resolviendo metadatos: {}", e))?
}
