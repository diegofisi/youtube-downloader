use tauri::{AppHandle, Emitter};

use super::models::AnalyzedEntry;
use super::service;
use crate::core::paths;

/// Analyzes a batch of URLs and returns previews (single video or playlist). Emits `preview-progress` {done, total};
/// optional 1-based `start`/`end` paginate playlists/feeds via `--playlist-items`.
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
            let entry = service::analyze(&app_dir, url, range)
                .unwrap_or_else(|msg| service::error_entry(url, &msg));
            out.push(entry);
            let _ = app.emit("preview-progress", (i + 1, total));
        }

        out
    })
    .await
    .map_err(|e| format!("Error interno analizando URLs: {}", e))
}
