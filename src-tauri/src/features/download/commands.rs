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
    run_id: Option<String>,
) -> Result<DownloadResult, String> {
    let app_dir = paths::app_dir(&app);
    // The frontend names each run (`<item>:<runSeq>`); the URL is only a fallback for
    // callers that don't. Register before the blocking thread so an early cancel finds it.
    let run_id = run_id.unwrap_or_else(|| url.clone());
    app.state::<DownloadRegistry>().begin(&run_id);
    let (app_for_err, run_id_for_err) = (app.clone(), run_id.clone());

    // spawn_blocking uses tokio's blocking pool, so a long download does NOT
    // occupy an async runtime worker (which would freeze analyze_urls, login, etc.).
    tauri::async_runtime::spawn_blocking(move || {
        // The registry lives in Tauri State; grab it from the handle
        // (State<> can't move into a blocking thread).
        let registry = app.state::<DownloadRegistry>();
        service::start(&app, &registry, &app_dir, &url, &options, &run_id)
    })
    .await
    .map_err(|e| {
        // A panicking thread never reached finish(): drop the entry here.
        app_for_err
            .state::<DownloadRegistry>()
            .finish(&run_id_for_err);
        format!("Error interno en el hilo de descarga: {}", e)
    })
}

#[tauri::command]
pub fn cancel_download(registry: State<'_, DownloadRegistry>, run_id: Option<String>) -> bool {
    // Sets cancelled and kills the PID under one lock: also covers the
    // process-less window of the post-cache retry and the name simulation.
    registry.cancel(run_id.as_deref())
}
