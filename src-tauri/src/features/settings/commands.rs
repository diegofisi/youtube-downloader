use tauri::AppHandle;

use super::service;
use super::service::AppConfig;
use crate::core::paths;

#[tauri::command]
pub fn get_settings(app: AppHandle) -> AppConfig {
    let app_dir = paths::app_dir(&app);
    service::load(&app_dir)
}

#[tauri::command]
pub fn set_settings(
    app: AppHandle,
    default_quality: String,
    default_container: String,
    default_audio_format: String,
    default_concurrency: u32,
) -> Result<(), String> {
    let app_dir = paths::app_dir(&app);
    service::set_defaults(
        &app_dir,
        default_quality,
        default_container,
        default_audio_format,
        default_concurrency,
    )
}

#[tauri::command]
pub fn open_downloads_folder(app: AppHandle) {
    let app_dir = paths::app_dir(&app);
    let downloads = service::get_download_folder(&app_dir);
    std::fs::create_dir_all(&downloads).ok();

    let path = downloads.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").arg(&path).spawn().ok();
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&path).spawn().ok();
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(&path).spawn().ok();
    }
}

#[tauri::command]
pub fn get_download_folder(app: AppHandle) -> String {
    let app_dir = paths::app_dir(&app);
    service::get_download_folder(&app_dir)
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub fn set_download_folder(app: AppHandle, folder: String) -> Result<String, String> {
    let app_dir = paths::app_dir(&app);
    let path = std::path::Path::new(&folder);
    std::fs::create_dir_all(path).map_err(|e| format!("No se pudo crear la carpeta: {}", e))?;
    service::set_download_folder(&app_dir, &folder)?;
    Ok(folder)
}
