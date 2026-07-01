use tauri::{AppHandle, Emitter};

use super::models::{AnalyzedEntry, VideoMeta};
use super::service;
use crate::core::paths;

/// Analiza un lote de URLs y devuelve preview (video suelto o playlist).
/// Emite `preview-progress` {done, total} durante el análisis.
#[tauri::command]
pub async fn analyze_urls(app: AppHandle, urls: Vec<String>) -> Result<Vec<AnalyzedEntry>, String> {
    let app_dir = paths::app_dir(&app);

    let handle = std::thread::spawn(move || {
        let total = urls.len();
        let mut out: Vec<AnalyzedEntry> = Vec::with_capacity(total);

        for (i, url) in urls.iter().enumerate() {
            let entry = match service::analyze(&app_dir, url) {
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
                    flat: false,
                    is_playlist: false,
                }),
            };
            out.push(entry);
            let _ = app.emit("preview-progress", (i + 1, total));
        }

        out
    });

    handle
        .join()
        .map_err(|_| "Error interno analizando URLs".to_string())
}

/// Metadatos completos de un solo video (para resolución bajo demanda).
#[tauri::command]
pub async fn get_video_metadata(app: AppHandle, url: String) -> Result<AnalyzedEntry, String> {
    let app_dir = paths::app_dir(&app);
    let handle = std::thread::spawn(move || service::analyze(&app_dir, &url));
    handle
        .join()
        .map_err(|_| "Error interno resolviendo metadatos".to_string())?
}
