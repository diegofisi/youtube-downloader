use tauri::AppHandle;

use super::models::{LibraryEntry, NewEntry};
use super::service;
use crate::core::paths;

#[tauri::command]
pub fn get_history(app: AppHandle) -> Vec<LibraryEntry> {
    let app_dir = paths::app_dir(&app);
    service::list(&app_dir)
}

// Flat arguments are the `invoke` contract with the frontend (library.api.ts).
// Internally they are grouped into `NewEntry`.
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

/// Deletes an entry's file (trash → permanent fallback) and removes the
/// history entry. Returns "trash" | "permanent" | "no_file".
#[tauri::command]
pub async fn delete_history_file(app: AppHandle, id: String) -> Result<String, String> {
    let app_dir = paths::app_dir(&app);
    // Trashing is a Windows COM operation that can take hundreds of ms;
    // spawn_blocking avoids freezing the UI (same pattern as start_download).
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
