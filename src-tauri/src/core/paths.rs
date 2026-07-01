//! Resolución de rutas y binarios (única fuente; antes duplicada).
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// Directorio base de la app: raíz del repo en dev, AppData/Local en release.
pub fn app_dir(app: &AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        let exe_path = std::env::current_exe().unwrap();
        let exe_dir = exe_path.parent().unwrap();
        let mut dir = exe_dir.to_path_buf();
        for _ in 0..5 {
            if dir.join("tauri.conf.json").exists() {
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
        app.path().resource_dir().unwrap_or(exe_dir.to_path_buf())
    } else {
        let data_dir = app
            .path()
            .app_local_data_dir()
            .expect("No se pudo obtener directorio de datos de la app");
        std::fs::create_dir_all(&data_dir).ok();
        data_dir
    }
}

pub fn binary_name(name: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{}.exe", name)
    } else {
        name.to_string()
    }
}

/// Busca un binario en el app_dir y en su directorio padre (modo dev).
pub fn find_executable(app_dir: &Path, name: &str) -> Option<PathBuf> {
    let bin = binary_name(name);
    let local = app_dir.join(&bin);
    if local.exists() {
        return Some(local);
    }
    if let Some(parent) = app_dir.parent() {
        let parent_path = parent.join(&bin);
        if parent_path.exists() {
            return Some(parent_path);
        }
    }
    None
}

pub fn has_binary(app_dir: &Path, name: &str) -> bool {
    find_executable(app_dir, name).is_some()
}
