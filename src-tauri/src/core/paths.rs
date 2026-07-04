//! Path and binary resolution (single source; previously duplicated).
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// App base directory: `<project>/.dev-data` in dev (keeps runtime files out of
/// the repo tree), AppData/Local in release.
pub fn app_dir(app: &AppHandle) -> PathBuf {
    if cfg!(debug_assertions) {
        let exe_path = std::env::current_exe().unwrap();
        let exe_dir = exe_path.parent().unwrap();
        let mut dir = exe_dir.to_path_buf();
        for _ in 0..5 {
            let root = if dir.join("tauri.conf.json").exists() {
                dir.parent().map(Path::to_path_buf)
            } else if dir.join("src-tauri").exists() {
                Some(dir.clone())
            } else {
                None
            };
            if let Some(root) = root {
                let data = root.join(".dev-data");
                std::fs::create_dir_all(&data).ok();
                return data;
            }
            if let Some(parent) = dir.parent() {
                dir = parent.to_path_buf();
            } else {
                break;
            }
        }
        app.path().resource_dir().unwrap_or(exe_dir.to_path_buf())
    } else {
        // No expect: if Tauri's resolver fails, fall back to a writable temp dir instead of
        // panicking. The exe dir is no fallback: in release it's usually read-only Program Files.
        let data_dir = app.path().app_local_data_dir().unwrap_or_else(|e| {
            eprintln!(
                "No se pudo obtener el directorio de datos de la app ({}); usando temp como fallback",
                e
            );
            std::env::temp_dir().join("stash")
        });
        std::fs::create_dir_all(&data_dir).ok();
        data_dir
    }
}

fn binary_name(name: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{}.exe", name)
    } else {
        name.to_string()
    }
}

/// Looks for a binary in app_dir and in its parent directory (dev mode).
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
