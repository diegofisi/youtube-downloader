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
    let handle = std::thread::spawn(move || service::download_dependencies(&app, &dir));

    match handle.join() {
        Ok(result) => result,
        Err(_) => Err("Error interno en el hilo de configuración".into()),
    }
}
