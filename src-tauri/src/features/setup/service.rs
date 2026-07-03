use std::fs;
use std::io::{self, Read, Write};
use std::path::Path;

use tauri::{AppHandle, Emitter};

use super::models::{DependencyStatus, SetupProgress};
use crate::core::paths;

// ── Pinned dependency versions ─────────────────────────────────────────────
// Concrete tags are downloaded (not `releases/latest`) so an untested new
// version can't silently break the app.

// Tested version — update deliberately.
const YTDLP_VERSION: &str = "2026.03.17";

// Tested version — update deliberately.
const DENO_VERSION: &str = "v2.9.1";

// Tested version — update deliberately. BtbN's stable "latest" tag ships assets
// pinned per series: this one tracks the 7.1 branch (7.1.x patches only, no major jumps).
const FFMPEG_WINDOWS_URL: &str =
    "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-win64-gpl-7.1.zip";

// Tested version — update deliberately.
// evermeet.cx publishes versioned zips; pinned to 7.1 (same series as Windows).
const FFMPEG_MACOS_URL: &str = "https://evermeet.cx/ffmpeg/ffmpeg-7.1.zip";

/// Checks whether the dependencies exist in app_dir.
pub fn check_dependencies(app_dir: &Path) -> DependencyStatus {
    let ytdlp = paths::has_binary(app_dir, "yt-dlp");
    let ffmpeg = paths::has_binary(app_dir, "ffmpeg");
    let deno = paths::has_binary(app_dir, "deno");

    DependencyStatus {
        ytdlp,
        ffmpeg,
        deno,
        ready: ytdlp && ffmpeg && deno,
    }
}

/// Downloads any missing dependencies.
pub fn download_dependencies(app: &AppHandle, app_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(app_dir).map_err(|e| format!("No se pudo crear directorio: {}", e))?;

    let status = check_dependencies(app_dir);

    if !status.ytdlp {
        emit_progress(app, "yt-dlp", 0.0, "Descargando yt-dlp...");
        download_ytdlp(app, app_dir)?;
        emit_progress(app, "yt-dlp", 100.0, "yt-dlp instalado");
    }

    if !status.ffmpeg {
        emit_progress(app, "ffmpeg", 0.0, "Descargando ffmpeg...");
        download_ffmpeg(app, app_dir)?;
        emit_progress(app, "ffmpeg", 100.0, "ffmpeg instalado");
    }

    if !status.deno {
        emit_progress(app, "deno", 0.0, "Descargando deno (runtime JS)...");
        download_deno(app, app_dir)?;
        emit_progress(app, "deno", 100.0, "deno instalado");
    }

    emit_progress(app, "done", 100.0, "Todo listo");
    Ok(())
}

fn emit_progress(app: &AppHandle, step: &str, percent: f64, message: &str) {
    let _ = app.emit(
        "setup-progress",
        SetupProgress {
            step: step.to_string(),
            percent,
            message: message.to_string(),
        },
    );
}

fn download_ytdlp(app: &AppHandle, app_dir: &Path) -> Result<(), String> {
    let (asset, filename) = if cfg!(target_os = "windows") {
        ("yt-dlp.exe", "yt-dlp.exe")
    } else if cfg!(target_os = "macos") {
        ("yt-dlp_macos", "yt-dlp")
    } else {
        ("yt-dlp", "yt-dlp")
    };

    let url = format!(
        "https://github.com/yt-dlp/yt-dlp/releases/download/{}/{}",
        YTDLP_VERSION, asset
    );

    let dest = app_dir.join(filename);
    download_file(app, &url, &dest, "yt-dlp")?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&dest, fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("No se pudo hacer ejecutable: {}", e))?;
    }

    Ok(())
}

fn download_ffmpeg(app: &AppHandle, app_dir: &Path) -> Result<(), String> {
    if cfg!(target_os = "windows") {
        download_ffmpeg_windows(app, app_dir)
    } else if cfg!(target_os = "macos") {
        download_ffmpeg_macos(app, app_dir)
    } else {
        Err("Plataforma no soportada para descarga automática de ffmpeg".to_string())
    }
}

fn download_ffmpeg_windows(app: &AppHandle, app_dir: &Path) -> Result<(), String> {
    let url = FFMPEG_WINDOWS_URL;
    let zip_path = app_dir.join("ffmpeg-temp.zip");

    download_file(app, url, &zip_path, "ffmpeg")?;
    emit_progress(app, "ffmpeg", 80.0, "Extrayendo ffmpeg...");

    let file = fs::File::open(&zip_path).map_err(|e| format!("No se pudo abrir zip: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("No se pudo leer zip: {}", e))?;

    let mut found = false;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Error leyendo zip: {}", e))?;
        let name = entry.name().to_string();

        if name.ends_with("ffmpeg.exe") && !name.contains("ffprobe") {
            let dest = app_dir.join("ffmpeg.exe");
            let mut outfile = fs::File::create(&dest)
                .map_err(|e| format!("No se pudo crear ffmpeg.exe: {}", e))?;
            io::copy(&mut entry, &mut outfile).map_err(|e| format!("Error extrayendo: {}", e))?;
            found = true;
            break;
        }
    }

    fs::remove_file(&zip_path).ok();

    if !found {
        return Err("No se encontró ffmpeg.exe en el archivo descargado".to_string());
    }

    Ok(())
}

fn download_ffmpeg_macos(app: &AppHandle, app_dir: &Path) -> Result<(), String> {
    let url = FFMPEG_MACOS_URL;
    let zip_path = app_dir.join("ffmpeg-temp.zip");

    download_file(app, url, &zip_path, "ffmpeg")?;
    emit_progress(app, "ffmpeg", 80.0, "Extrayendo ffmpeg...");

    let file = fs::File::open(&zip_path).map_err(|e| format!("No se pudo abrir zip: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("No se pudo leer zip: {}", e))?;

    let mut found = false;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Error leyendo zip: {}", e))?;
        let name = entry.name().to_string();

        if name == "ffmpeg" || name.ends_with("/ffmpeg") {
            let dest = app_dir.join("ffmpeg");
            let mut outfile =
                fs::File::create(&dest).map_err(|e| format!("No se pudo crear ffmpeg: {}", e))?;
            io::copy(&mut entry, &mut outfile).map_err(|e| format!("Error extrayendo: {}", e))?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&dest, fs::Permissions::from_mode(0o755)).ok();
            }
            found = true;
            break;
        }
    }

    fs::remove_file(&zip_path).ok();

    if !found {
        return Err("No se encontró ffmpeg en el archivo descargado".to_string());
    }

    Ok(())
}

fn download_deno(app: &AppHandle, app_dir: &Path) -> Result<(), String> {
    let (asset, bin_name) = if cfg!(target_os = "windows") {
        ("deno-x86_64-pc-windows-msvc.zip", "deno.exe")
    } else if cfg!(target_os = "macos") {
        ("deno-aarch64-apple-darwin.zip", "deno")
    } else {
        ("deno-x86_64-unknown-linux-gnu.zip", "deno")
    };

    let url = format!(
        "https://github.com/denoland/deno/releases/download/{}/{}",
        DENO_VERSION, asset
    );

    let zip_path = app_dir.join("deno-temp.zip");
    download_file(app, &url, &zip_path, "deno")?;
    emit_progress(app, "deno", 80.0, "Extrayendo deno...");

    let file = fs::File::open(&zip_path).map_err(|e| format!("No se pudo abrir zip: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("No se pudo leer zip: {}", e))?;

    let mut found = false;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Error leyendo zip: {}", e))?;
        let name = entry.name().to_string();

        if name == bin_name || name.ends_with(bin_name) {
            let dest = app_dir.join(bin_name);
            let mut outfile = fs::File::create(&dest)
                .map_err(|e| format!("No se pudo crear {}: {}", bin_name, e))?;
            io::copy(&mut entry, &mut outfile).map_err(|e| format!("Error extrayendo: {}", e))?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&dest, fs::Permissions::from_mode(0o755)).ok();
            }

            found = true;
            break;
        }
    }

    fs::remove_file(&zip_path).ok();

    if !found {
        return Err(format!(
            "No se encontró {} en el archivo descargado",
            bin_name
        ));
    }

    Ok(())
}

fn download_file(app: &AppHandle, url: &str, dest: &Path, step: &str) -> Result<(), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {}", e))?;

    let response = client
        .get(url)
        .send()
        .map_err(|e| format!("Error descargando {}: {}", step, e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Error descargando {} (HTTP {})",
            step,
            response.status()
        ));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;

    let mut file = fs::File::create(dest)
        .map_err(|e| format!("No se pudo crear archivo {}: {}", dest.display(), e))?;

    let mut reader = response;
    let mut buffer = [0u8; 8192];

    loop {
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|e| format!("Error leyendo datos: {}", e))?;

        if bytes_read == 0 {
            break;
        }

        file.write_all(&buffer[..bytes_read])
            .map_err(|e| format!("Error escribiendo archivo: {}", e))?;

        downloaded += bytes_read as u64;

        if total_size > 0 {
            let percent = (downloaded as f64 / total_size as f64) * 70.0;
            emit_progress(
                app,
                step,
                percent,
                &format!(
                    "Descargando {}... {:.1} MB / {:.1} MB",
                    step,
                    downloaded as f64 / 1_048_576.0,
                    total_size as f64 / 1_048_576.0
                ),
            );
        }
    }

    Ok(())
}
