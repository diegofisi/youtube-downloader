use tauri::AppHandle;

use crate::commands::cookies::app_dir;
use crate::models::DependencyStatus;
use crate::services::setup_service;

#[tauri::command]
pub fn check_dependencies(app: AppHandle) -> DependencyStatus {
    let dir = app_dir(&app);
    setup_service::check_dependencies(&dir)
}

#[tauri::command]
pub async fn download_dependencies(app: AppHandle) -> Result<(), String> {
    let dir = app_dir(&app);
    let handle = std::thread::spawn(move || {
        setup_service::download_dependencies(&app, &dir)
    });

    match handle.join() {
        Ok(result) => result,
        Err(_) => Err("Error interno en el hilo de configuración".into()),
    }
}
