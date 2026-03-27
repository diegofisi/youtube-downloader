use tauri::{AppHandle, Manager};

use crate::models::CookieResult;
use crate::services::{config_service, cookie_service};

fn get_app_dir(app: &AppHandle) -> std::path::PathBuf {
    let exe_path = std::env::current_exe().unwrap();
    let exe_dir = exe_path.parent().unwrap();

    // In development, use the project root (two levels up from src-tauri/target/debug)
    if cfg!(debug_assertions) {
        // Try to find the project root by looking for tauri.conf.json
        let mut dir = exe_dir.to_path_buf();
        for _ in 0..5 {
            if dir.join("tauri.conf.json").exists() {
                // We're in src-tauri, go up one level
                return dir.parent().unwrap().to_path_buf();
            }
            if dir.join("src-tauri").exists() {
                return dir.to_path_buf();
            }
            if let Some(parent) = dir.parent() {
                dir = parent.to_path_buf();
            } else {
                break;
            }
        }
        // Fallback: use resource dir
        app.path().resource_dir().unwrap_or(exe_dir.to_path_buf())
    } else {
        exe_dir.to_path_buf()
    }
}

#[tauri::command]
pub fn check_cookies(app: AppHandle) -> CookieResult {
    let app_dir = get_app_dir(&app);
    cookie_service::check(&app_dir)
}

#[tauri::command]
pub fn load_cookies(app: AppHandle, path: String) -> CookieResult {
    let app_dir = get_app_dir(&app);
    cookie_service::load(&app_dir, &path)
}

#[tauri::command]
pub fn open_downloads_folder(app: AppHandle) {
    let app_dir = get_app_dir(&app);
    let downloads = config_service::get_download_folder(&app_dir);
    std::fs::create_dir_all(&downloads).ok();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(downloads.to_string_lossy().to_string())
            .spawn()
            .ok();
    }
}

#[tauri::command]
pub fn get_download_folder(app: AppHandle) -> String {
    let app_dir = get_app_dir(&app);
    let folder = config_service::get_download_folder(&app_dir);
    folder.to_string_lossy().to_string()
}

#[tauri::command]
pub fn set_download_folder(app: AppHandle, folder: String) -> Result<String, String> {
    let app_dir = get_app_dir(&app);
    let path = std::path::Path::new(&folder);
    std::fs::create_dir_all(path).map_err(|e| format!("No se pudo crear la carpeta: {}", e))?;
    config_service::set_download_folder(&app_dir, &folder)?;
    Ok(folder)
}

// Re-export get_app_dir for use in download commands
pub fn app_dir(app: &AppHandle) -> std::path::PathBuf {
    get_app_dir(app)
}
