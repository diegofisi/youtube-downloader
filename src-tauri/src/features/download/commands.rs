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

    // spawn_blocking usa el pool bloqueante de tokio (cientos de hilos), así una
    // descarga larga NO ocupa un worker del runtime async (que congelaría analyze_urls,
    // login, etc.).
    tauri::async_runtime::spawn_blocking(move || {
        // El registry vive en el State de Tauri; se recupera desde el handle
        // (State<> no puede moverse a un hilo bloqueante).
        let registry = app.state::<DownloadRegistry>();
        service::start(&app, &registry, &app_dir, &url, &options)
    })
    .await
    .map_err(|e| format!("Error interno en el hilo de descarga: {}", e))
}

#[tauri::command]
pub fn cancel_download(registry: State<'_, DownloadRegistry>, url: Option<String>) -> bool {
    // Marca cancelled y mata el PID bajo el mismo lock: cubre también la
    // ventana sin proceso del reintento post-cache y la simulación de nombre.
    registry.cancel(url.as_deref())
}
