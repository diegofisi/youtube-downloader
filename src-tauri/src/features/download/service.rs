use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter};

use super::models::{DownloadOptions, DownloadResult};
use crate::core::models::ProgressData;
use crate::core::process::{self, DownloadRegistry};
use crate::core::ytdlp::{self, classify_error, YtdlpCmd};
use crate::features::session::service as session;
use crate::features::settings::service as settings;

fn get_output_dir(app_dir: &Path) -> PathBuf {
    let dir = settings::get_download_folder(app_dir);
    std::fs::create_dir_all(&dir).ok();
    dir
}

const AUTH_ERROR_MSG: &str =
    "Sesión de YouTube caducada o inválida. Reconecta tu cuenta de YouTube para descargar este contenido.";
const CANCELLED_MSG: &str = "Descarga cancelada por el usuario.";

/// Clears the yt-dlp cache (`yt-dlp --rm-cache-dir`).
/// Not via YtdlpCmd because it doesn't operate on a URL.
fn clear_ytdlp_cache(app_dir: &Path) {
    let mut cmd = Command::new(ytdlp::bin(app_dir));
    cmd.arg("--rm-cache-dir")
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    process::hide_console(&mut cmd);

    match cmd.status() {
        Ok(s) => println!("[download] Cache de yt-dlp limpiado (exit: {:?})", s.code()),
        Err(e) => eprintln!("[download] No se pudo limpiar el cache de yt-dlp: {}", e),
    }
}

pub fn start(
    app: &AppHandle,
    registry: &DownloadRegistry,
    app_dir: &Path,
    url: &str,
    options: &DownloadOptions,
    run_id: &str,
) -> DownloadResult {
    if let Err(msg) = options.validate() {
        registry.finish(run_id);
        return failure(msg, Some("other"));
    }

    // Windows/macOS-style duplicate handling: if the expected file already
    // exists, download with an " (N)" suffix instead of yt-dlp skipping it.
    let mut effective = options.clone();
    if let Some(tpl) = resolve_duplicate_template(registry, app_dir, url, options, run_id) {
        effective.output_template = Some(tpl);
    }

    // The simulation takes ~1-2s: abort if the user cancelled meanwhile.
    if registry.is_cancelled(run_id) {
        registry.finish(run_id);
        return failure(CANCELLED_MSG.into(), Some("cancelled"));
    }

    let mut result = run_with_retry(app, registry, app_dir, url, &effective, run_id);
    // A killed yt-dlp exits without an ERROR line: report the cancel, not a generic failure.
    if !result.success && registry.is_cancelled(run_id) {
        result = failure(CANCELLED_MSG.into(), Some("cancelled"));
    }
    registry.finish(run_id);
    result
}

/// Inserts " (N)" into the output template, before a trailing ".%(ext)s" if present.
fn template_with_suffix(tpl: &str, n: u32) -> String {
    const EXT_SUFFIX: &str = ".%(ext)s";
    if let Some(base) = tpl.strip_suffix(EXT_SUFFIX) {
        format!("{} ({}){}", base, n, EXT_SUFFIX)
    } else {
        format!("{} ({})", tpl, n)
    }
}

/// Inserts " (N)" into a path, before the extension.
fn path_with_suffix(path: &Path, n: u32) -> PathBuf {
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let name = match path.extension() {
        Some(ext) => format!("{} ({}).{}", stem, n, ext.to_string_lossy()),
        None => format!("{} ({})", stem, n),
    };
    path.with_file_name(name)
}

/// Plausible final paths for the simulated name: the one yt-dlp printed and,
/// if there is postprocessing (audio extraction/merge), the same with the real final extension.
fn expected_final_paths(simulated: &Path, options: &DownloadOptions) -> Vec<PathBuf> {
    let mut paths = vec![simulated.to_path_buf()];
    // Every non-audio mode passes --merge-output-format <container> (videoonly included).
    let final_ext = if options.mode == "audio" {
        options.audio_format.as_str()
    } else {
        options.container.as_str()
    };
    let alt = simulated.with_extension(final_ext);
    if alt != paths[0] {
        paths.push(alt);
    }
    paths
}

/// Simulates the download (`--print filename --no-download`) to learn the
/// expected output path. Returns None if the simulation fails.
fn simulate_filename(
    registry: &DownloadRegistry,
    app_dir: &Path,
    output_dir: &Path,
    url: &str,
    options: &DownloadOptions,
    run_id: &str,
) -> Option<PathBuf> {
    let mut builder = YtdlpCmd::new(app_dir, url)
        .args(options.to_ytdlp_args(output_dir))
        .arg("--print")
        .arg("filename")
        .arg("--no-download")
        .no_warnings()
        .no_update()
        // Same runtime as the real run, or the simulated name can diverge or fail.
        .ffmpeg_location()
        .deno_runtime()
        .stderr(Stdio::null());

    if matches!(options.cookie_mode.as_str(), "file" | "cookies") {
        builder = builder.cookies(&session::get_cookies_path(app_dir));
    }

    // spawn (not output()) so the PID gets registered: cancelling during the
    // simulation also kills this process (it used to be orphaned).
    let mut run = builder.build();
    let child = run.spawn().ok()?;
    registry.set_pid(run_id, child.id());
    let output = child.wait_with_output();
    registry.clear_pid(run_id);

    let output = output.ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout.lines().rev().find(|l| !l.trim().is_empty())?.trim();
    let path = PathBuf::from(line);
    if path.is_absolute() {
        Some(path)
    } else {
        None
    }
}

/// If the target file exists, returns a template with an " (N)" suffix
/// (N = 1..20) whose result doesn't exist yet. None = use the original template.
fn resolve_duplicate_template(
    registry: &DownloadRegistry,
    app_dir: &Path,
    url: &str,
    options: &DownloadOptions,
    run_id: &str,
) -> Option<String> {
    if registry.is_cancelled(run_id) {
        return None;
    }

    let output_dir = get_output_dir(app_dir);
    println!(
        "[download] Simulando nombre de salida para {} (~1-2s)...",
        url
    );
    let simulated = match simulate_filename(registry, app_dir, &output_dir, url, options, run_id) {
        Some(p) => p,
        None => {
            println!("[download] Simulación de nombre fallida; se usa la plantilla original.");
            return None;
        }
    };

    let existing = expected_final_paths(&simulated, options);
    if !existing.iter().any(|p| p.exists()) {
        return None;
    }
    println!(
        "[download] El archivo ya existe: {}. Buscando nombre libre con \" (N)\"...",
        simulated.display()
    );

    let base_tpl = options.effective_template();

    for n in 1..=20u32 {
        let free = existing.iter().all(|p| !path_with_suffix(p, n).exists());
        if free {
            let tpl = template_with_suffix(&base_tpl, n);
            println!(
                "[download] Duplicado resuelto: se descargará con plantilla \"{}\"",
                tpl
            );
            return Some(tpl);
        }
    }
    println!(
        "[download] No se encontró nombre libre tras 20 intentos; se usa la plantilla original."
    );
    None
}

fn run_with_retry(
    app: &AppHandle,
    registry: &DownloadRegistry,
    app_dir: &Path,
    url: &str,
    options: &DownloadOptions,
    run_id: &str,
) -> DownloadResult {
    // First attempt.
    let first = run_once(app, registry, app_dir, url, options, run_id);
    let RunOutcome {
        exit_ok,
        error_text,
        detail,
        file_path,
    } = match first {
        Ok(triple) => triple,
        Err(result) => return result, // yt-dlp failed to launch
    };

    if exit_ok {
        return DownloadResult {
            success: true,
            error: None,
            error_kind: None,
            file_path,
        };
    }

    let kind = classify_error(&error_text);

    // Stale cookies are rejected server-side even before they expire: a public video still
    // downloads without them, so retry ONCE cookie-less and let the frontend renew the session.
    let used_cookies = matches!(options.cookie_mode.as_str(), "file" | "cookies")
        && session::get_cookies_path(app_dir).exists();
    if kind == Some("auth") && used_cookies && !registry.is_cancelled(run_id) {
        println!(
            "[download] Sesión rechazada por YouTube en {}. Reintentando sin cookies (1/1)...",
            url
        );
        let mut anonymous = options.clone();
        anonymous.cookie_mode = "none".into();
        if let Ok(retry) = run_once(app, registry, app_dir, url, &anonymous, run_id) {
            if retry.exit_ok {
                let _ = app.emit("session-rejected", ());
                return DownloadResult {
                    success: true,
                    error: None,
                    error_kind: None,
                    file_path: retry.file_path,
                };
            }
        }
    }

    // HTTP 403 / forbidden: stale yt-dlp cache -> clear it and retry ONCE,
    // unless the user cancelled the download.
    if kind == Some("cache") && !registry.is_cancelled(run_id) {
        println!(
            "[download] HTTP 403 detectado en {}. Limpiando cache de yt-dlp y reintentando (1/1)...",
            url
        );
        clear_ytdlp_cache(app_dir);

        // Check cancelled right before the spawn: no relaunch if cancelled in the PID-less
        // window; a cancel right AFTER this check is caught by set_pid() (anti-race in core::process).
        if registry.is_cancelled(run_id) {
            return failure(error_text, Some("cache"));
        }

        let retry = run_once(app, registry, app_dir, url, options, run_id);
        let RunOutcome {
            exit_ok: retry_ok,
            error_text: retry_error,
            file_path: retry_file_path,
            ..
        } = match retry {
            Ok(triple) => triple,
            Err(result) => return result,
        };

        if retry_ok {
            println!(
                "[download] Reintento tras limpiar cache completado con éxito: {}",
                url
            );
            return DownloadResult {
                success: true,
                error: None,
                error_kind: None,
                file_path: retry_file_path,
            };
        }

        println!(
            "[download] El reintento tras limpiar cache también falló: {}",
            url
        );

        if classify_error(&retry_error) == Some("auth") {
            return failure(AUTH_ERROR_MSG.to_string(), Some("auth"));
        }
        let detail = if retry_error.is_empty() {
            String::new()
        } else {
            format!("\nDetalle: {}", retry_error)
        };
        return failure(
            format!(
                "Error HTTP 403 al descargar. Se limpió el caché de yt-dlp y se reintentó una vez, pero volvió a fallar.{}",
                detail
            ),
            Some("cache"),
        );
    }

    match kind {
        Some("auth") => failure(AUTH_ERROR_MSG.to_string(), Some("auth")),
        Some("cache") => failure(
            "Error HTTP 403 al descargar (descarga cancelada, no se reintentó).".to_string(),
            Some("cache"),
        ),
        _ => {
            // No ERROR line: generic copy plus the last stderr line as a diagnostic hint.
            let message = if !error_text.is_empty() {
                error_text
            } else if detail.is_empty() {
                "La descarga fallo. Revisa la URL o vuelve a cargar las cookies.".to_string()
            } else {
                format!(
                    "La descarga fallo. Revisa la URL o vuelve a cargar las cookies.\nDetalle: {}",
                    detail
                )
            };
            failure(message, Some("other"))
        }
    }
}

fn failure(message: String, kind: Option<&str>) -> DownloadResult {
    DownloadResult {
        success: false,
        error: Some(message),
        error_kind: kind.map(|k| k.to_string()),
        file_path: None,
    }
}

/// One yt-dlp run. `error_text` holds only `ERROR:` lines (the classifier's input);
/// `detail` is the last other stderr line, for the message when no ERROR was printed.
struct RunOutcome {
    exit_ok: bool,
    error_text: String,
    detail: String,
    file_path: Option<String>,
}

/// Runs yt-dlp once. Ok(outcome) if the process launched, Err(DownloadResult) if it couldn't even start.
fn run_once(
    app: &AppHandle,
    registry: &DownloadRegistry,
    app_dir: &Path,
    url: &str,
    options: &DownloadOptions,
    run_id: &str,
) -> Result<RunOutcome, DownloadResult> {
    let output_dir = get_output_dir(app_dir);

    // Args derived from the options (format/quality/audio/subs/template)
    // + common download flags. The builder adds --encoding utf-8 and `-- <url>`.
    let mut builder = YtdlpCmd::new(app_dir, url)
        .args(options.to_ytdlp_args(&output_dir))
        .arg("--newline")
        .arg("--progress")
        .no_update()
        // Prints the final file path to stdout after move/postprocessing. NOTE: --print
        // implies --quiet, so --no-quiet is forced to keep the progress/[Merger] lines we parse.
        .arg("--no-quiet")
        .arg("--print")
        .arg("after_move:filepath")
        .ffmpeg_location()
        .deno_runtime();

    if matches!(options.cookie_mode.as_str(), "file" | "cookies") {
        builder = builder.cookies(&session::get_cookies_path(app_dir));
    }

    // `run` must outlive the process: it owns the per-run cookie copy.
    let mut run = builder.build();
    let mut child = match run.spawn() {
        Ok(child) => child,
        Err(e) => {
            return Err(DownloadResult {
                success: false,
                error: Some(format!(
                    "No se pudo ejecutar yt-dlp. Verifica que la configuración inicial se completó correctamente.\n{}",
                    e
                )),
                error_kind: Some("other".into()),
                file_path: None,
            });
        }
    };

    // set_pid catches a cancel that happened during the spawn and kills the
    // process under the same lock (closes the post-cache retry race).
    registry.set_pid(run_id, child.id());

    let app_handle = app.clone();
    let last_error = Arc::new(Mutex::new(String::new()));
    let last_error_clone = Arc::clone(&last_error);
    let last_detail = Arc::new(Mutex::new(String::new()));
    let last_detail_clone = Arc::clone(&last_detail);
    // Last stdout line that is an existing absolute path (the one
    // `--print after_move:filepath` prints at the end).
    let final_path: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let final_path_clone = Arc::clone(&final_path);

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let app_for_stdout = app_handle.clone();
    let url_for_progress = url.to_string();
    let run_id_for_progress = run_id.to_string();
    let stdout_thread = std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            let Ok(line) = line else { continue };
            // Borrow: this runs per progress line; only the final-path branch allocates.
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            // The path from `--print after_move:filepath` comes first: a title with "%"
            // would otherwise be swallowed by the progress parser.
            if !trimmed.starts_with('[') {
                let p = Path::new(trimmed);
                if p.is_absolute() && p.exists() {
                    *final_path_clone.lock().unwrap() = Some(trimmed.to_string());
                    continue;
                }
            }

            let pct = trimmed
                .starts_with("[download]")
                .then(|| ytdlp::parse_percent(trimmed))
                .flatten();
            if let Some(pct) = pct {
                let speed = ytdlp::parse_field(trimmed, "at ", " ETA").unwrap_or_default();
                let eta = ytdlp::parse_field(trimmed, "ETA ", "").unwrap_or_default();

                let _ = app_for_stdout.emit(
                    "download-progress",
                    ProgressData {
                        percent: pct,
                        speed,
                        eta,
                        status: "downloading".into(),
                        url: url_for_progress.clone(),
                        run_id: Some(run_id_for_progress.clone()),
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
                        run_id: Some(run_id_for_progress.clone()),
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
            // Only "ERROR:" lines are classified; the last other line (ffmpeg, postprocessor)
            // is kept apart as a diagnostic detail.
            if let Some(rest) = trimmed.strip_prefix("ERROR:") {
                *last_error_clone.lock().unwrap() = rest.trim().to_string();
            } else if !trimmed.starts_with("WARNING:") {
                *last_detail_clone.lock().unwrap() = trimmed.to_string();
            }
        }
    });

    stdout_thread.join().ok();
    stderr_thread.join().ok();

    let exit_ok = child.wait().map(|s| s.success()).unwrap_or(false);

    // Only the PID is cleared: the entry (and its cancelled flag) lives until
    // start() calls finish(), covering a possible retry.
    registry.clear_pid(run_id);

    let error_text = last_error.lock().unwrap().clone();
    let detail = last_detail.lock().unwrap().clone();
    let file_path = final_path.lock().unwrap().clone();
    Ok(RunOutcome {
        exit_ok,
        error_text,
        detail,
        file_path,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---------- template_with_suffix ----------

    #[test]
    fn template_with_suffix_inserta_antes_de_ext() {
        assert_eq!(
            template_with_suffix("%(title)s [%(id)s].%(ext)s", 1),
            "%(title)s [%(id)s] (1).%(ext)s"
        );
    }

    #[test]
    fn template_with_suffix_sin_ext_agrega_al_final() {
        assert_eq!(template_with_suffix("%(title)s", 3), "%(title)s (3)");
    }

    // ---------- path_with_suffix ----------

    #[test]
    fn path_with_suffix_con_extension() {
        let p = PathBuf::from("C:/videos/mi video.mp4");
        assert_eq!(
            path_with_suffix(&p, 2),
            PathBuf::from("C:/videos/mi video (2).mp4")
        );
    }

    #[test]
    fn path_with_suffix_sin_extension() {
        let p = PathBuf::from("C:/videos/archivo");
        assert_eq!(
            path_with_suffix(&p, 1),
            PathBuf::from("C:/videos/archivo (1)")
        );
    }

    // ---------- expected_final_paths ----------

    fn opciones(mode: &str) -> DownloadOptions {
        DownloadOptions {
            mode: mode.into(),
            audio_format: "mp3".into(),
            container: "mp4".into(),
            ..DownloadOptions::default()
        }
    }

    #[test]
    fn expected_final_paths_modo_audio_agrega_extension_de_audio() {
        let paths = expected_final_paths(Path::new("C:/dl/cancion.webm"), &opciones("audio"));
        assert_eq!(
            paths,
            vec![
                PathBuf::from("C:/dl/cancion.webm"),
                PathBuf::from("C:/dl/cancion.mp3")
            ]
        );
    }

    #[test]
    fn expected_final_paths_modo_video_agrega_contenedor() {
        let paths = expected_final_paths(Path::new("C:/dl/video.webm"), &opciones("video"));
        assert_eq!(
            paths,
            vec![
                PathBuf::from("C:/dl/video.webm"),
                PathBuf::from("C:/dl/video.mp4")
            ]
        );
    }

    #[test]
    fn expected_final_paths_no_duplica_si_la_extension_ya_coincide() {
        let paths = expected_final_paths(Path::new("C:/dl/video.mp4"), &opciones("video"));
        assert_eq!(paths, vec![PathBuf::from("C:/dl/video.mp4")]);
    }

    #[test]
    fn expected_final_paths_videoonly_uses_the_container_too() {
        let paths = expected_final_paths(Path::new("C:/dl/video.webm"), &opciones("videoonly"));
        assert_eq!(
            paths,
            vec![
                PathBuf::from("C:/dl/video.webm"),
                PathBuf::from("C:/dl/video.mp4")
            ]
        );
    }
}
