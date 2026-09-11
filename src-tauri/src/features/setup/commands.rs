use tauri::AppHandle;

use super::models::{DependencyStatus, SourceStatus};
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
    // spawn_blocking: uses reqwest::blocking inside; must not run on the async runtime.
    tauri::async_runtime::spawn_blocking(move || service::download_dependencies(&app, &dir))
        .await
        .map_err(|e| format!("Error interno en el hilo de configuración: {}", e))?
}

/// Probes the pinned download URLs (HEAD): the startup warning and Ajustes → "Comprobar fuentes".
#[tauri::command]
pub async fn check_dependency_sources() -> Result<Vec<SourceStatus>, String> {
    tauri::async_runtime::spawn_blocking(service::check_sources)
        .await
        .map_err(|e| format!("Error interno comprobando fuentes: {}", e))
}
