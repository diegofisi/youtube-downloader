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

    // Ejecutar en un hilo bloqueante para no bloquear el runtime async.
    let handle = std::thread::spawn(move || service::start(&app, &app_dir, &url, &options));

    match handle.join() {
        Ok(result) => Ok(result),
        Err(_) => Ok(DownloadResult {
            success: false,
            error: Some("Error interno en el hilo de descarga".into()),
        }),
    }
}

#[tauri::command]
pub fn cancel_download(url: Option<String>) -> bool {
    match url {
        Some(u) => process::kill_by_url(&u),
        None => process::kill_all(),
    }
}
