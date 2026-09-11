use std::fs;
use std::io::{self, Read, Write};
use std::path::Path;

/// Copies a zip entry into `dest`, removing the partial file on failure so
/// `check_dependencies` (existence-only) never sees a truncated binary.
fn extract_entry(entry: &mut impl Read, dest: &Path) -> Result<(), String> {
    let mut outfile = fs::File::create(dest)
        .map_err(|e| format!("No se pudo crear {}: {}", dest.display(), e))?;
    if let Err(e) = io::copy(entry, &mut outfile) {
        drop(outfile);
        fs::remove_file(dest).ok();
        return Err(format!("Error extrayendo: {}", e));
    }
    Ok(())
}

use tauri::{AppHandle, Emitter};

use super::models::{DependencyStatus, SetupProgress};
use crate::core::paths;

// ── Pinned dependency versions ─────────────────────────────────────────────
// Concrete tags are downloaded (not `releases/latest`) so an untested new
// version can't silently break the app.

// Tested version — update deliberately. YouTube breaks old releases within months
// (HTTP 403 on media), so bumping this is the fix when downloads start failing everywhere.
const YTDLP_VERSION: &str = "2026.08.19";

/// Marker next to the binary recording which yt-dlp release was installed: lets a version
/// bump re-download on existing installs without spawning `yt-dlp --version` at startup.
const YTDLP_VERSION_FILE: &str = "yt-dlp.version";

fn ytdlp_is_current(app_dir: &Path) -> bool {
    fs::read_to_string(app_dir.join(YTDLP_VERSION_FILE))
        .map(|v| v.trim() == YTDLP_VERSION)
        .unwrap_or(false)
}

// Tested version — update deliberately.
const DENO_VERSION: &str = "v2.9.1";

// Tested build — update deliberately. The dated autobuild tag is permanent; assets under
// BtbN's rolling "latest" tag get renamed when a series is dropped (the 7.1 one 404'd on
// fresh installs), so they are only fallbacks, tried in order.
const FFMPEG_WINDOWS_URLS: [&str; 3] = [
    "https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-09-11-13-20/ffmpeg-n8.1.2-52-g5a03dfa0f6-win64-gpl-8.1.zip",
    "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n8.1-latest-win64-gpl-8.1.zip",
    "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
];

// Tested version — update deliberately.
// evermeet.cx publishes versioned zips; pinned to 7.1 (same series as Windows).
const FFMPEG_MACOS_URL: &str = "https://evermeet.cx/ffmpeg/ffmpeg-7.1.zip";

/// Checks whether the dependencies exist in app_dir (yt-dlp must also be the pinned release).
pub fn check_dependencies(app_dir: &Path) -> DependencyStatus {
    let ytdlp = paths::has_binary(app_dir, "yt-dlp") && ytdlp_is_current(app_dir);
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
/// Guards against concurrent installs (onboarding "Omitir" + Settings "Repair"):
/// two runs writing the same binaries would corrupt each other.
static INSTALL_IN_PROGRESS: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Releases the install flag on every exit path, panics included (a latched flag would
/// block onboarding and Repair until restart).
struct InstallGuard;

impl Drop for InstallGuard {
    fn drop(&mut self) {
        INSTALL_IN_PROGRESS.store(false, std::sync::atomic::Ordering::SeqCst);
    }
}

pub fn download_dependencies(app: &AppHandle, app_dir: &Path) -> Result<(), String> {
    use std::sync::atomic::Ordering;
    if INSTALL_IN_PROGRESS.swap(true, Ordering::SeqCst) {
        return Err("Ya hay una instalación de componentes en curso.".into());
    }
    let _guard = InstallGuard;
    download_dependencies_inner(app, app_dir)
}

fn download_dependencies_inner(app: &AppHandle, app_dir: &Path) -> Result<(), String> {
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
    fs::write(app_dir.join(YTDLP_VERSION_FILE), YTDLP_VERSION)
        .map_err(|e| format!("No se pudo registrar la versión de yt-dlp: {}", e))?;

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
    let zip_path = app_dir.join("ffmpeg-temp.zip");

    let mut last_error = String::new();
    let mut downloaded = false;
    for url in FFMPEG_WINDOWS_URLS {
        match download_file(app, url, &zip_path, "ffmpeg") {
            Ok(()) => {
                downloaded = true;
                break;
            }
            Err(e) => {
                eprintln!("[setup] ffmpeg no disponible en {}: {}", url, e);
                last_error = e;
            }
        }
    }
    if !downloaded {
        return Err(last_error);
    }
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
            if let Err(e) = extract_entry(&mut entry, &dest) {
                fs::remove_file(&zip_path).ok();
                return Err(e);
            }
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
            if let Err(e) = extract_entry(&mut entry, &dest) {
                fs::remove_file(&zip_path).ok();
                return Err(e);
            }

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
    } else if cfg!(target_os = "macos") && cfg!(target_arch = "aarch64") {
        ("deno-aarch64-apple-darwin.zip", "deno")
    } else if cfg!(target_os = "macos") {
        ("deno-x86_64-apple-darwin.zip", "deno")
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
            if let Err(e) = extract_entry(&mut entry, &dest) {
                fs::remove_file(&zip_path).ok();
                return Err(e);
            }

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

/// Downloads with one automatic retry on transport errors (flaky Wi-Fi); an HTTP error
/// status is final so a missing asset fails fast to the next candidate URL.
fn download_file(app: &AppHandle, url: &str, dest: &Path, step: &str) -> Result<(), String> {
    match download_file_once(app, url, dest, step) {
        Err(e) if !e.contains("(HTTP ") => {
            eprintln!("[setup] {} — reintentando una vez", e);
            download_file_once(app, url, dest, step)
        }
        other => other,
    }
}

fn download_file_once(app: &AppHandle, url: &str, dest: &Path, step: &str) -> Result<(), String> {
    // The ffmpeg archive is ~190 MB: a slow line legitimately needs well over the old
    // 5-minute cap, so the whole-request budget is 30 min (the blocking client has no per-read timeout).
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(30))
        .timeout(std::time::Duration::from_secs(30 * 60))
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

    // Stream into a .part and rename at the end: a kill/power loss mid-download must
    // never leave a truncated binary at the final path (check_dependencies only tests existence).
    let part = dest.with_file_name(format!(
        "{}.part",
        dest.file_name()
            .map(|n| n.to_string_lossy())
            .unwrap_or_default()
    ));
    let mut file = fs::File::create(&part)
        .map_err(|e| format!("No se pudo crear archivo {}: {}", part.display(), e))?;

    let mut reader = response;
    let mut buffer = [0u8; 8192];

    let copy_result = loop {
        let bytes_read = match reader.read(&mut buffer) {
            Ok(n) => n,
            Err(e) => break Err(format!("Error leyendo datos: {}", e)),
        };

        if bytes_read == 0 {
            break Ok(());
        }

        if let Err(e) = file.write_all(&buffer[..bytes_read]) {
            break Err(format!("Error escribiendo archivo: {}", e));
        }

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
    };

    let copy_result = copy_result.and_then(|()| {
        if total_size > 0 && downloaded != total_size {
            Err(format!(
                "Descarga incompleta de {} ({} de {} bytes)",
                step, downloaded, total_size
            ))
        } else {
            Ok(())
        }
    });

    drop(file);
    if let Err(e) = copy_result {
        fs::remove_file(&part).ok();
        return Err(e);
    }
    fs::rename(&part, dest).map_err(|e| {
        fs::remove_file(&part).ok();
        format!("No se pudo mover {} a su destino: {}", step, e)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempDir(std::path::PathBuf);
    impl TempDir {
        fn new(tag: &str) -> Self {
            let dir =
                std::env::temp_dir().join(format!("ytd-setup-{}-{}", tag, std::process::id()));
            fs::create_dir_all(&dir).unwrap();
            TempDir(dir)
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).ok();
        }
    }

    #[test]
    fn ytdlp_without_a_version_marker_is_not_current() {
        let dir = TempDir::new("nomarker");
        assert!(!ytdlp_is_current(&dir.0));
    }

    #[test]
    fn ytdlp_with_an_older_marker_is_not_current() {
        let dir = TempDir::new("old");
        fs::write(
            dir.0.join(YTDLP_VERSION_FILE),
            "2026.03.17
",
        )
        .unwrap();
        assert!(!ytdlp_is_current(&dir.0));
    }

    #[test]
    fn ytdlp_with_the_pinned_marker_is_current() {
        let dir = TempDir::new("current");
        fs::write(
            dir.0.join(YTDLP_VERSION_FILE),
            format!(
                "{}
",
                YTDLP_VERSION
            ),
        )
        .unwrap();
        assert!(ytdlp_is_current(&dir.0));
    }
}
