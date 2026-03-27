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

fn find_executable(app_dir: &Path, name: &str) -> Option<PathBuf> {
    let local = app_dir.join(name);
    if local.exists() {
        return Some(local);
    }

    // Check parent directory (development)
    if let Some(parent) = app_dir.parent() {
        let parent_path = parent.join(name);
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
    ];

    // ffmpeg location
    if let Some(ffmpeg) = find_executable(app_dir, "ffmpeg.exe") {
        if let Some(dir) = ffmpeg.parent() {
            args.push("--ffmpeg-location".into());
            args.push(dir.to_string_lossy().into());
        }
    }

    // deno for YouTube JS challenges
    if let Some(deno) = find_executable(app_dir, "deno.exe") {
        args.push("--extractor-args".into());
        args.push(format!("youtube:js_runtimes=deno:{}", deno.to_string_lossy()));
    }

    // cookies — always use file-based cookies if available
    match cookie_mode {
        "file" | "cookies" => {
            let cookies_path = cookie_service::get_cookies_path(app_dir);
            if cookies_path.exists() {
                args.push("--cookies".into());
                args.push(cookies_path.to_string_lossy().into());
            }
        }
        _ => {} // "none" — no cookies
    }

    args.push(url.into());

    // Find yt-dlp: check local directory first, then PATH
    let ytdlp = find_executable(app_dir, "yt-dlp.exe")
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|| "yt-dlp".into());

    // Spawn yt-dlp process
    let child = match Command::new(&ytdlp)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW on Windows
        .spawn()
    {
        Ok(child) => child,
        Err(e) => {
            return DownloadResult {
                success: false,
                error: Some(format!(
                    "No se pudo ejecutar yt-dlp. Asegúrate de tenerlo instalado (pip install yt-dlp).\n{}",
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

    // Read stdout in thread
    let stdout = child.stdout.unwrap();
    let stderr = child.stderr.unwrap();

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

            // Parse progress: "[download]  45.2% of ~50.00MiB at  5.2MiB/s ETA 00:12"
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
        let mut has_error_line = false;
        for line in reader.lines() {
            let Ok(line) = line else { continue };
            let trimmed = line.trim().to_string();
            if trimmed.is_empty() {
                continue;
            }
            // Prioritize lines starting with "ERROR:" — they have the real message
            if trimmed.starts_with("ERROR:") {
                let clean = trimmed
                    .trim_start_matches("ERROR:")
                    .trim()
                    .to_string();
                *last_error_clone.lock().unwrap() = clean;
                has_error_line = true;
            } else if !has_error_line {
                *last_error_clone.lock().unwrap() = trimmed;
            }
        }
    });

    stdout_thread.join().ok();
    stderr_thread.join().ok();

    unregister_process(url);

    // Check if the download was successful by looking at output dir
    let error_text = last_error.lock().unwrap().clone();

    if error_text.is_empty()
        || error_text.contains("Deleting original file")
        || error_text.contains("has already been downloaded")
    {
        DownloadResult {
            success: true,
            error: None,
        }
    } else {
        DownloadResult {
            success: false,
            error: Some(error_text),
        }
    }
}

pub fn cancel_by_url(url: &str) -> bool {
    let guard = ACTIVE_PROCESSES.lock().unwrap();
    if let Some(map) = guard.as_ref() {
        if let Some(&pid) = map.get(url) {
            Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .creation_flags(0x08000000)
                .spawn()
                .ok();
            return true;
        }
    }
    false
}

pub fn cancel() -> bool {
    let guard = ACTIVE_PROCESSES.lock().unwrap();
    if let Some(map) = guard.as_ref() {
        for &pid in map.values() {
            Command::new("taskkill")
                .args(["/F", "/PID", &pid.to_string()])
                .creation_flags(0x08000000)
                .spawn()
                .ok();
        }
        return !map.is_empty();
    }
    false
}

fn parse_percent(s: &str) -> Option<f64> {
    // Match patterns like "45.2%" in the string
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
