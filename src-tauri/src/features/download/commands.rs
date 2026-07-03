use tauri::{AppHandle, Manager, State};

use super::models::{DownloadOptions, DownloadResult};
use super::service;
use crate::core::paths;
use crate::core::process::DownloadRegistry;

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    url: String,
    options: DownloadOptions,
) -> Result<DownloadResult, String> {
    let app_dir = paths::app_dir(&app);

    // spawn_blocking uses tokio's blocking pool, so a long download does NOT
    // occupy an async runtime worker (which would freeze analyze_urls, login, etc.).
    tauri::async_runtime::spawn_blocking(move || {
        // The registry lives in Tauri State; grab it from the handle
        // (State<> can't move into a blocking thread).
        let registry = app.state::<DownloadRegistry>();
        service::start(&app, &registry, &app_dir, &url, &options)
    })
    .await
    .map_err(|e| format!("Error interno en el hilo de descarga: {}", e))
}

#[tauri::command]
pub fn cancel_download(registry: State<'_, DownloadRegistry>, url: Option<String>) -> bool {
    // Sets cancelled and kills the PID under one lock: also covers the
    // process-less window of the post-cache retry and the name simulation.
    registry.cancel(url.as_deref())
}
