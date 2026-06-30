use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use tauri::{AppHandle, Emitter};

use crate::models::{DownloadResult, ProgressData};
use crate::services::{config_service, cookie_service};

static ACTIVE_PROCESSES: Mutex<Option<HashMap<String, u32>>> = Mutex::new(None);

fn register_process(url: &str, pid: u32) {
    let mut guard = ACTIVE_PROCESSES.lock().unwrap();
    let map = guard.get_or_insert_with(HashMap::new);
    map.insert(url.to_string(), pid);
}

fn unregister_process(url: &str) {
    let mut guard = ACTIVE_PROCESSES.lock().unwrap();
    if let Some(map) = guard.as_mut() {
        map.remove(url);
    }
}

fn binary_name(name: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{}.exe", name)
    } else {
        name.to_string()
    }
}

fn find_executable(app_dir: &Path, name: &str) -> Option<PathBuf> {
    let bin = binary_name(name);
    let local = app_dir.join(&bin);
    if local.exists() {
        return Some(local);
    }

    // Check parent directory (development)
    if let Some(parent) = app_dir.parent() {
        let parent_path = parent.join(&bin);
        if parent_path.exists() {
            return Some(parent_path);
        }
    }

    None
}

fn get_output_dir(app_dir: &Path) -> PathBuf {
    let dir = config_service::get_download_folder(app_dir);
    std::fs::create_dir_all(&dir).ok();
    dir
}

fn kill_process(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("taskkill");
        cmd.args(["/F", "/PID", &pid.to_string()]);
        cmd.creation_flags(0x08000000);
        cmd.spawn().ok();
    }

    #[cfg(not(target_os = "windows"))]
    {
        Command::new("kill")
            .args(["-9", &pid.to_string()])
            .spawn()
            .ok();
    }
}

pub fn start(
    app: &AppHandle,
    app_dir: &Path,
    url: &str,
    cookie_mode: &str,
) -> DownloadResult {
    let output_dir = get_output_dir(app_dir);

    let mut args: Vec<String> = vec![
        "-f".into(),
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best".into(),
        "--merge-output-format".into(),
        "mp4".into(),
        "-o".into(),
        output_dir
            .join("%(title)s [%(id)s].%(ext)s")
            .to_string_lossy()
            .into(),
        "--newline".into(),
        "--progress".into(),
        // Evita que yt-dlp imprima la advertencia de actualizacion en stderr,
        // que antes se confundia con un error real.
        "--no-update".into(),
    ];

    // ffmpeg location
    if let Some(ffmpeg) = find_executable(app_dir, "ffmpeg") {
        if let Some(dir) = ffmpeg.parent() {
            args.push("--ffmpeg-location".into());
            args.push(dir.to_string_lossy().into());
        }
    }

    // deno for YouTube JS extraction (required)
    if let Some(deno) = find_executable(app_dir, "deno") {
        args.push("--extractor-args".into());
        args.push(format!("youtube:js_runtimes=deno:{}", deno.to_string_lossy()));
    }

    // cookies
    match cookie_mode {
        "file" | "cookies" => {
            let cookies_path = cookie_service::get_cookies_path(app_dir);
            if cookies_path.exists() {
                args.push("--cookies".into());
                args.push(cookies_path.to_string_lossy().into());
            }
        }
        _ => {}
    }

    args.push(url.into());

    // Find yt-dlp: check local directory first, then PATH
    let ytdlp = find_executable(app_dir, "yt-dlp")
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "yt-dlp".into());

    // Spawn yt-dlp process
    let mut cmd = Command::new(&ytdlp);
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            return DownloadResult {
                success: false,
                error: Some(format!(
                    "No se pudo ejecutar yt-dlp. Verifica que la configuración inicial se completó correctamente.\n{}",
                    e
                )),
            };
        }
    };

    let pid = child.id();
    register_process(url, pid);

    let app_handle = app.clone();
    let last_error = Arc::new(Mutex::new(String::new()));
    let last_error_clone = Arc::clone(&last_error);

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_for_stdout = app_handle.clone();
    let url_for_progress = url.to_string();
    let stdout_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            let Ok(line) = line else { continue };
            let trimmed = line.trim().to_string();
            if trimmed.is_empty() {
                continue;
            }

            if let Some(pct) = parse_percent(&trimmed) {
                let speed = parse_field(&trimmed, "at ", " ETA").unwrap_or_default();
                let eta = parse_field(&trimmed, "ETA ", "").unwrap_or_default();

                let _ = app_for_stdout.emit(
                    "download-progress",
                    ProgressData {
                        percent: pct,
                        speed,
                        eta,
                        status: "downloading".into(),
                        url: url_for_progress.clone(),
                    },
                );
            } else if trimmed.contains("[Merger]") || trimmed.contains("Merging") {
                let _ = app_for_stdout.emit(
                    "download-progress",
                    ProgressData {
                        percent: 95.0,
                        speed: String::new(),
                        eta: String::new(),
                        status: "processing".into(),
                        url: url_for_progress.clone(),
                    },
                );
            }
        }
    });

    let stderr_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            let Ok(line) = line else { continue };
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            // Solo las lineas "ERROR:" cuentan como error real. Las advertencias
            // (WARNING:, avisos de actualizacion, etc.) se ignoran.
            if let Some(rest) = trimmed.strip_prefix("ERROR:") {
                *last_error_clone.lock().unwrap() = rest.trim().to_string();
            }
        }
    });

    stdout_thread.join().ok();
    stderr_thread.join().ok();

    // El codigo de salida del proceso es la senal real de exito/fallo.
    let exit_ok = child.wait().map(|s| s.success()).unwrap_or(false);

    unregister_process(url);

    let error_text = last_error.lock().unwrap().clone();

    if exit_ok {
        DownloadResult {
            success: true,
            error: None,
        }
    } else {
        let message = if error_text.is_empty() {
            "La descarga fallo. Revisa la URL o vuelve a cargar las cookies.".to_string()
        } else {
            error_text
        };
        DownloadResult {
            success: false,
            error: Some(message),
        }
    }
}

pub fn cancel_by_url(url: &str) -> bool {
    let guard = ACTIVE_PROCESSES.lock().unwrap();
    if let Some(map) = guard.as_ref() {
        if let Some(&pid) = map.get(url) {
            kill_process(pid);
            return true;
        }
    }
    false
}

pub fn cancel() -> bool {
    let guard = ACTIVE_PROCESSES.lock().unwrap();
    if let Some(map) = guard.as_ref() {
        for &pid in map.values() {
            kill_process(pid);
        }
        return !map.is_empty();
    }
    false
}

fn parse_percent(s: &str) -> Option<f64> {
    let re_like = s.find('%')?;
    let before = &s[..re_like];
    let num_start = before.rfind(|c: char| !c.is_ascii_digit() && c != '.')? + 1;
    before[num_start..].parse::<f64>().ok()
}

fn parse_field(s: &str, start_marker: &str, end_marker: &str) -> Option<String> {
    let start = s.find(start_marker)? + start_marker.len();
    if end_marker.is_empty() {
        Some(s[start..].trim().to_string())
    } else {
        let end = s[start..].find(end_marker).map(|i| start + i)?;
        Some(s[start..end].trim().to_string())
    }
}
