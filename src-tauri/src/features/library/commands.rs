use tauri::AppHandle;

use super::models::{LibraryEntry, NewEntry};
use super::service;
use crate::core::paths;

#[tauri::command]
pub fn get_history(app: AppHandle) -> Vec<LibraryEntry> {
    let app_dir = paths::app_dir(&app);
    service::list(&app_dir)
}

// El comando mantiene los argumentos planos: son el contrato `invoke` con el
// frontend (library.api.ts). Internamente se agrupan en `NewEntry`.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn add_history(
    app: AppHandle,
    url: String,
    title: String,
    format: String,
    video_id: Option<String>,
    thumbnail: Option<String>,
    duration: Option<f64>,
    file_path: Option<String>,
) -> Result<LibraryEntry, String> {
    let app_dir = paths::app_dir(&app);
    service::add(
        &app_dir,
        NewEntry {
            url,
            title,
            format,
            video_id,
            thumbnail,
            duration,
            file_path,
        },
    )
}

#[tauri::command]
pub fn remove_history_item(app: AppHandle, id: String) -> Result<(), String> {
    let app_dir = paths::app_dir(&app);
    service::remove(&app_dir, &id)
}

/// Borra el archivo de una entrada (papelera → permanente como fallback) y
/// elimina la entrada del historial. Devuelve "trash" | "permanent" | "no_file".
#[tauri::command]
pub async fn delete_history_file(app: AppHandle, id: String) -> Result<String, String> {
    let app_dir = paths::app_dir(&app);
    // Enviar a la papelera es una operación COM de Windows que puede tardar
    // cientos de ms; spawn_blocking evita congelar la UI (mismo patrón que
    // start_download).
    tauri::async_runtime::spawn_blocking(move || service::delete_file(&app_dir, &id))
        .await
        .map_err(|e| format!("Error interno borrando archivo: {}", e))?
}

#[tauri::command]
pub fn clear_history(app: AppHandle) -> Result<(), String> {
    let app_dir = paths::app_dir(&app);
    service::clear(&app_dir)
}

#[tauri::command]
pub fn open_history_folder(_app: AppHandle, folder: String) {
    service::open_path(&folder);
}
