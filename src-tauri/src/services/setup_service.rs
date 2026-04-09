use std::fs;
use std::io::{self, Read, Write};
use std::path::Path;

use tauri::{AppHandle, Emitter};

use crate::models::{DependencyStatus, SetupProgress};

/// Check if required dependencies exist in app directory
pub fn check_dependencies(app_dir: &Path) -> DependencyStatus {
    let ytdlp = find_binary(app_dir, "yt-dlp");
    let ffmpeg = find_binary(app_dir, "ffmpeg");
    let deno = find_binary(app_dir, "deno");

    DependencyStatus {
        ytdlp,
        ffmpeg,
        deno,
        ready: ytdlp && ffmpeg && deno,
    }
}

/// Download all missing dependencies
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

/// Download yt-dlp binary from GitHub releases
fn download_ytdlp(app: &AppHandle, app_dir: &Path) -> Result<(), String> {
    let (url, filename) = if cfg!(target_os = "windows") {
        (
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
            "yt-dlp.exe",
        )
    } else if cfg!(target_os = "macos") {
        (
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
            "yt-dlp",
        )
    } else {
        (
            "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
            "yt-dlp",
        )
    };

    let dest = app_dir.join(filename);
    download_file(app, url, &dest, "yt-dlp")?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&dest, fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("No se pudo hacer ejecutable: {}", e))?;
    }

    Ok(())
}

/// Download ffmpeg (platform-specific)
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
    let url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip";
    let zip_path = app_dir.join("ffmpeg-temp.zip");

    download_file(app, url, &zip_path, "ffmpeg")?;
    emit_progress(app, "ffmpeg", 80.0, "Extrayendo ffmpeg...");

    // Extract only ffmpeg.exe from the zip
    let file = fs::File::open(&zip_path)
        .map_err(|e| format!("No se pudo abrir zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("No se pudo leer zip: {}", e))?;

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
            io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Error extrayendo: {}", e))?;
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
    let url = "https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip";
    let zip_path = app_dir.join("ffmpeg-temp.zip");

    download_file(app, url, &zip_path, "ffmpeg")?;
    emit_progress(app, "ffmpeg", 80.0, "Extrayendo ffmpeg...");

    let file = fs::File::open(&zip_path)
        .map_err(|e| format!("No se pudo abrir zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("No se pudo leer zip: {}", e))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Error leyendo zip: {}", e))?;
        let name = entry.name().to_string();

        if name == "ffmpeg" || name.ends_with("/ffmpeg") {
            let dest = app_dir.join("ffmpeg");
            let mut outfile = fs::File::create(&dest)
                .map_err(|e| format!("No se pudo crear ffmpeg: {}", e))?;
            io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Error extrayendo: {}", e))?;

            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&dest, fs::Permissions::from_mode(0o755)).ok();
            }
            break;
        }
    }

    fs::remove_file(&zip_path).ok();
    Ok(())
}

/// Download deno runtime (required by yt-dlp for YouTube JS extraction)
fn download_deno(app: &AppHandle, app_dir: &Path) -> Result<(), String> {
    let (url, bin_name) = if cfg!(target_os = "windows") {
        (
            "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip",
            "deno.exe",
        )
    } else if cfg!(target_os = "macos") {
        // Use aarch64 for Apple Silicon (most modern Macs)
        (
            "https://github.com/denoland/deno/releases/latest/download/deno-aarch64-apple-darwin.zip",
            "deno",
        )
    } else {
        (
            "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip",
            "deno",
        )
    };

    let zip_path = app_dir.join("deno-temp.zip");
    download_file(app, url, &zip_path, "deno")?;
    emit_progress(app, "deno", 80.0, "Extrayendo deno...");

    let file = fs::File::open(&zip_path)
        .map_err(|e| format!("No se pudo abrir zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("No se pudo leer zip: {}", e))?;

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
            io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Error extrayendo: {}", e))?;

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
        return Err(format!("No se encontró {} en el archivo descargado", bin_name));
    }

    Ok(())
}

/// Download a file with progress reporting
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

fn find_binary(app_dir: &Path, name: &str) -> bool {
    let bin_name = if cfg!(target_os = "windows") {
        format!("{}.exe", name)
    } else {
        name.to_string()
    };

    if app_dir.join(&bin_name).exists() {
        return true;
    }

    // Also check parent dir (development mode)
    if let Some(parent) = app_dir.parent() {
        if parent.join(&bin_name).exists() {
            return true;
        }
    }

    false
}
