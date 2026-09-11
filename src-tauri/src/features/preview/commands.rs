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
        let mut session_rejected = false;

        for (i, url) in urls.iter().enumerate() {
            let entry = match service::analyze(&app_dir, url, range) {
                Ok(analysis) => {
                    session_rejected |= analysis.session_rejected;
                    analysis.entry
                }
                Err(err) => service::error_entry(url, &err),
            };
            out.push(entry);
            let _ = app.emit("preview-progress", (i + 1, total));
        }

        // One signal per batch: the frontend renews the session (or tells the user).
        if session_rejected {
            let _ = app.emit("session-rejected", ());
        }
        out
    })
    .await
    .map_err(|e| format!("Error interno analizando URLs: {}", e))
}
