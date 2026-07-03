use tauri::AppHandle;

use super::models::DependencyStatus;
use super::service;
use crate::core::paths;

#[tauri::command]
pub fn check_dependencies(app: AppHandle) -> DependencyStatus {
    let dir = paths::app_dir(&app);
    service::check_dependencies(&dir)
}

#[tauri::command]
pub async fn download_dependencies(app: AppHandle) -> Result<(), String> {
    let dir = paths::app_dir(&app);
    // spawn_blocking: usa reqwest::blocking dentro; no debe correr en el runtime async.
    tauri::async_runtime::spawn_blocking(move || service::download_dependencies(&app, &dir))
        .await
        .map_err(|e| format!("Error interno en el hilo de configuración: {}", e))?
}
