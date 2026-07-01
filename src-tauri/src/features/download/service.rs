use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use tauri::{AppHandle, Emitter};

use super::models::DownloadResult;
use crate::core::models::ProgressData;
use crate::core::{paths, process, ytdlp};
use crate::features::session::service as session;
use crate::features::settings::service as settings;

fn get_output_dir(app_dir: &Path) -> PathBuf {
    let dir = settings::get_download_folder(app_dir);
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn start(app: &AppHandle, app_dir: &Path, url: &str, cookie_mode: &str) -> DownloadResult {
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
        // Evita la advertencia de actualizacion de yt-dlp en stderr.
        "--no-update".into(),
    ];

    if let Some(ffmpeg) = paths::find_executable(app_dir, "ffmpeg") {
        if let Some(dir) = ffmpeg.parent() {
            args.push("--ffmpeg-location".into());
            args.push(dir.to_string_lossy().into());
        }
    }

    if let Some(deno) = paths::find_executable(app_dir, "deno") {
        args.push("--extractor-args".into());
        args.push(format!("youtube:js_runtimes=deno:{}", deno.to_string_lossy()));
    }

    match cookie_mode {
        "file" | "cookies" => {
            let cookies_path = session::get_cookies_path(app_dir);
            if cookies_path.exists() {
                args.push("--cookies".into());
                args.push(cookies_path.to_string_lossy().into());
            }
        }
        _ => {}
    }

    args.push(url.into());

    let ytdlp_bin = paths::find_executable(app_dir, "yt-dlp")
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "yt-dlp".into());

    let mut cmd = Command::new(&ytdlp_bin);
    cmd.args(&args).stdout(Stdio::piped()).stderr(Stdio::piped());

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
    process::register(url, pid);

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

            if let Some(pct) = ytdlp::parse_percent(&trimmed) {
                let speed = ytdlp::parse_field(&trimmed, "at ", " ETA").unwrap_or_default();
                let eta = ytdlp::parse_field(&trimmed, "ETA ", "").unwrap_or_default();

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
            // Solo las lineas "ERROR:" cuentan como error real.
            if let Some(rest) = trimmed.strip_prefix("ERROR:") {
                *last_error_clone.lock().unwrap() = rest.trim().to_string();
            }
        }
    });

    stdout_thread.join().ok();
    stderr_thread.join().ok();

    let exit_ok = child.wait().map(|s| s.success()).unwrap_or(false);

    process::unregister(url);

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
