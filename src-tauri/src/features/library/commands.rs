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
) -> Result<LibraryEntry, String> {
    let app_dir = paths::app_dir(&app);
    service::add(&app_dir, url, title, format)
}

#[tauri::command]
pub fn remove_history_item(app: AppHandle, id: String) -> Result<(), String> {
    let app_dir = paths::app_dir(&app);
    service::remove(&app_dir, &id)
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
