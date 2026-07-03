use tauri::AppHandle;

use super::models::LibraryEntry;
use super::service;
use crate::core::paths;

#[tauri::command]
pub fn get_history(app: AppHandle) -> Vec<LibraryEntry> {
    let app_dir = paths::app_dir(&app);
    service::list(&app_dir)
}

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
        &app_dir, url, title, format, video_id, thumbnail, duration, file_path,
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
pub fn delete_history_file(app: AppHandle, id: String) -> Result<String, String> {
    let app_dir = paths::app_dir(&app);
    service::delete_file(&app_dir, &id)
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
