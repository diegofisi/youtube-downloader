use tauri::AppHandle;

use super::models::{DownloadOptions, DownloadResult};
use super::service;
use crate::core::{paths, process};

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    url: String,
    options: DownloadOptions,
) -> Result<DownloadResult, String> {
    let app_dir = paths::app_dir(&app);

    // spawn_blocking usa el pool bloqueante de tokio (cientos de hilos), así una
    // descarga larga NO ocupa un worker del runtime async (que congelaría analyze_urls,
    // login, etc.).
    tauri::async_runtime::spawn_blocking(move || service::start(&app, &app_dir, &url, &options))
        .await
        .map_err(|e| format!("Error interno en el hilo de descarga: {}", e))
}

#[tauri::command]
pub fn cancel_download(url: Option<String>) -> bool {
    // Marcar como cancelada ANTES de matar el proceso, para que el
    // auto-reintento por 403 no resucite una descarga cancelada.
    service::mark_cancelled(url.as_deref());
    match url {
        Some(u) => process::kill_by_url(&u),
        None => process::kill_all(),
    }
}
