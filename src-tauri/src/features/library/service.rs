use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::models::LibraryEntry;
use crate::features::settings::service as settings;

fn history_path(app_dir: &Path) -> PathBuf {
    app_dir.join("history.json")
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn now_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0)
}

pub fn list(app_dir: &Path) -> Vec<LibraryEntry> {
    let path = history_path(app_dir);
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn write(app_dir: &Path, entries: &[LibraryEntry]) -> Result<(), String> {
    let path = history_path(app_dir);
    let content = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("Error al serializar historial: {}", e))?;
    // Escritura atómica: escribir a tmp y renombrar.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, content).map_err(|e| format!("Error al guardar historial: {}", e))?;
    fs::rename(&tmp, &path).map_err(|e| format!("Error al guardar historial: {}", e))?;
    Ok(())
}

pub fn add(app_dir: &Path, url: String, title: String, format: String) -> Result<LibraryEntry, String> {
    let mut all = list(app_dir);
    let folder = settings::get_download_folder(app_dir)
        .to_string_lossy()
        .to_string();
    let entry = LibraryEntry {
        id: now_nanos().to_string(),
        url,
        title,
        format,
        folder,
        date: now_secs(),
    };
    all.insert(0, entry.clone());
    // Limitar a 500 entradas.
    all.truncate(500);
    write(app_dir, &all)?;
    Ok(entry)
}

pub fn remove(app_dir: &Path, id: &str) -> Result<(), String> {
    let mut all = list(app_dir);
    all.retain(|e| e.id != id);
    write(app_dir, &all)
}

pub fn clear(app_dir: &Path) -> Result<(), String> {
    write(app_dir, &[])
}

pub fn open_path(path: &str) {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer").arg(path).spawn().ok();
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(path).spawn().ok();
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open").arg(path).spawn().ok();
    }
}
