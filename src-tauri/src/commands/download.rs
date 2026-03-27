use tauri::AppHandle;

use crate::models::DownloadResult;
use crate::services::download_service;
use super::cookies;

#[tauri::command]
pub async fn start_download(app: AppHandle, url: String, cookie_mode: String) -> Result<DownloadResult, String> {
    let app_dir = cookies::app_dir(&app);

    // Run download in a blocking thread so we don't block the async runtime
    let handle = std::thread::spawn(move || {
        download_service::start(&app, &app_dir, &url, &cookie_mode)
    });

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
        Some(u) => download_service::cancel_by_url(&u),
        None => download_service::cancel(),
    }
}
