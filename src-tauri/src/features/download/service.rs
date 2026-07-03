use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter};

use super::models::{DownloadOptions, DownloadResult};
use crate::core::models::ProgressData;
use crate::core::process::{self, DownloadRegistry};
use crate::core::ytdlp::{self, YtdlpCmd};
use crate::features::session::service as session;
use crate::features::settings::service as settings;

fn get_output_dir(app_dir: &Path) -> PathBuf {
    let dir = settings::get_download_folder(app_dir);
    std::fs::create_dir_all(&dir).ok();
    dir
}

/// Clasifica el texto de error de yt-dlp: "auth" (sesión/cookies inválidas),
/// "cache" (HTTP 403 / fragmentos forbidden, típico de cache viciado) o None.
fn classify_error(error_text: &str) -> Option<&'static str> {
    let e = error_text.to_lowercase();

    let is_auth = e.contains("sign in to confirm")
        || e.contains("this video is available to this channel's members")
        || e.contains("members-only")
        || e.contains("cookies are no longer valid")
        || e.contains("please sign in")
        || e.contains("not a bot")
        || e.contains("http error 401");
    if is_auth {
        return Some("auth");
    }

    let is_cache = e.contains("http error 403")
        || e.contains("forbidden")
        || (e.contains("fragment") && e.contains("403"));
    if is_cache {
        return Some("cache");
    }

    None
}

const AUTH_ERROR_MSG: &str =
    "Sesión de YouTube caducada o inválida. Reconecta tu cuenta de YouTube para descargar este contenido.";

/// Limpia el cache de yt-dlp (equivale a `yt-dlp --rm-cache-dir`).
/// No usa YtdlpCmd porque no opera sobre una URL.
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
) -> DownloadResult {
    registry.begin(url);

    // Resolución de duplicados estilo Windows/macOS: si el archivo esperado ya
    // existe, se descarga con sufijo " (N)" en vez de que yt-dlp lo salte.
    let mut effective = options.clone();
    if let Some(tpl) = resolve_duplicate_template(registry, app_dir, url, options) {
        effective.output_template = Some(tpl);
    }

    // La simulación tarda ~1-2s: si el usuario canceló mientras tanto, abortar.
    if registry.is_cancelled(url) {
        registry.finish(url);
        return failure("Descarga cancelada por el usuario.".into(), Some("other"));
    }

    let result = run_with_retry(app, registry, app_dir, url, &effective);
    registry.finish(url);
    result
}

/// Inserta " (N)" en la plantilla de salida, antes del ".%(ext)s" final si existe.
fn template_with_suffix(tpl: &str, n: u32) -> String {
    const EXT_SUFFIX: &str = ".%(ext)s";
    if let Some(base) = tpl.strip_suffix(EXT_SUFFIX) {
        format!("{} ({}){}", base, n, EXT_SUFFIX)
    } else {
        format!("{} ({})", tpl, n)
    }
}

/// Inserta " (N)" en una ruta, antes de la extensión.
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

/// Rutas finales plausibles para el nombre simulado: la impresa por yt-dlp y,
/// si hay postprocesado (extracción de audio / merge), la misma con la
/// extensión final real.
fn expected_final_paths(simulated: &Path, options: &DownloadOptions) -> Vec<PathBuf> {
    let mut paths = vec![simulated.to_path_buf()];
    let final_ext = if options.mode == "audio" {
        Some(options.audio_format.as_str())
    } else if options.mode == "video" {
        Some(options.container.as_str())
    } else {
        None
    };
    if let Some(ext) = final_ext {
        let alt = simulated.with_extension(ext);
        if alt != paths[0] {
            paths.push(alt);
        }
    }
    paths
}

/// Simula la descarga (`--print filename --no-download`) para conocer la ruta
/// de salida esperada. Devuelve None si la simulación falla.
fn simulate_filename(
    registry: &DownloadRegistry,
    app_dir: &Path,
    output_dir: &Path,
    url: &str,
    options: &DownloadOptions,
) -> Option<PathBuf> {
    let mut builder = YtdlpCmd::new(app_dir, url)
        .args(options.to_ytdlp_args(output_dir))
        .arg("--print")
        .arg("filename")
        .arg("--no-download")
        .no_warnings()
        .no_update()
        .stderr(Stdio::null());

    if matches!(options.cookie_mode.as_str(), "file" | "cookies") {
        builder = builder.cookies(&session::get_cookies_path(app_dir));
    }

    // spawn (y no output()) para registrar el PID: así "cancelar" durante la
    // simulación también mata este proceso (antes quedaba huérfano).
    let child = builder.build().spawn().ok()?;
    registry.set_pid(url, child.id());
    let output = child.wait_with_output();
    registry.clear_pid(url);

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

/// Si el archivo destino ya existe, devuelve una plantilla con sufijo " (N)"
/// (N = 1..20) cuyo resultado no exista aún. None = usar la plantilla original.
fn resolve_duplicate_template(
    registry: &DownloadRegistry,
    app_dir: &Path,
    url: &str,
    options: &DownloadOptions,
) -> Option<String> {
    if registry.is_cancelled(url) {
        return None;
    }

    let output_dir = get_output_dir(app_dir);
    println!(
        "[download] Simulando nombre de salida para {} (~1-2s)...",
        url
    );
    let simulated = match simulate_filename(registry, app_dir, &output_dir, url, options) {
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

    let base_tpl = options
        .output_template
        .clone()
        .filter(|t| !t.trim().is_empty())
        .unwrap_or_else(|| "%(title)s [%(id)s].%(ext)s".into());

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
) -> DownloadResult {
    // Primer intento.
    let first = run_once(app, registry, app_dir, url, options);
    let (exit_ok, error_text, file_path) = match first {
        Ok(triple) => triple,
        Err(result) => return result, // no se pudo lanzar yt-dlp
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

    // HTTP 403 / forbidden: cache de yt-dlp viciado -> limpiar y reintentar UNA vez,
    // salvo que el usuario haya cancelado la descarga.
    if kind == Some("cache") && !registry.is_cancelled(url) {
        println!(
            "[download] HTTP 403 detectado en {}. Limpiando cache de yt-dlp y reintentando (1/1)...",
            url
        );
        clear_ytdlp_cache(app_dir);

        // Consultar cancelled justo antes del spawn: si el usuario canceló en
        // la ventana sin PID, no se relanza. Y si cancela justo DESPUÉS de
        // esta consulta, set_pid() lo detectará y matará el proceso (ver
        // esquema anti-race en core::process).
        if registry.is_cancelled(url) {
            return failure(error_text, Some("cache"));
        }

        let retry = run_once(app, registry, app_dir, url, options);
        let (retry_ok, retry_error, retry_file_path) = match retry {
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
            let message = if error_text.is_empty() {
                "La descarga fallo. Revisa la URL o vuelve a cargar las cookies.".to_string()
            } else {
                error_text
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

/// Ejecuta yt-dlp una vez. Devuelve Ok((exit_ok, ultimo_error, ruta_final)) si el
/// proceso llegó a lanzarse, o Err(DownloadResult) si ni siquiera se pudo ejecutar.
fn run_once(
    app: &AppHandle,
    registry: &DownloadRegistry,
    app_dir: &Path,
    url: &str,
    options: &DownloadOptions,
) -> Result<(bool, String, Option<String>), DownloadResult> {
    let output_dir = get_output_dir(app_dir);

    // Args derivados de las opciones (formato/calidad/audio/subs/plantilla)
    // + comunes de descarga. El builder añade --encoding utf-8 y `-- <url>`.
    let mut builder = YtdlpCmd::new(app_dir, url)
        .args(options.to_ytdlp_args(&output_dir))
        .arg("--newline")
        .arg("--progress")
        .no_update()
        // Imprime por stdout la ruta final del archivo tras moverlo/postprocesarlo.
        // OJO: --print implica --quiet, por eso se fuerza --no-quiet para no perder
        // las líneas de progreso/[Merger] que ya parseamos.
        .arg("--no-quiet")
        .arg("--print")
        .arg("after_move:filepath")
        .ffmpeg_location()
        .deno_runtime();

    if matches!(options.cookie_mode.as_str(), "file" | "cookies") {
        builder = builder.cookies(&session::get_cookies_path(app_dir));
    }

    let mut child = match builder.build().spawn() {
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

    // set_pid detecta un cancel ocurrido durante el spawn y mata el proceso
    // bajo el mismo lock (cierre de la race del reintento post-cache).
    registry.set_pid(url, child.id());

    let app_handle = app.clone();
    let last_error = Arc::new(Mutex::new(String::new()));
    let last_error_clone = Arc::clone(&last_error);
    // Última línea de stdout que sea una ruta absoluta existente (la que
    // imprime `--print after_move:filepath` al terminar).
    let final_path: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let final_path_clone = Arc::clone(&final_path);

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
            } else if !trimmed.starts_with('[') {
                // Candidata a ruta impresa por `--print after_move:filepath`:
                // ruta absoluta y existente en disco.
                let p = Path::new(&trimmed);
                if p.is_absolute() && p.exists() {
                    *final_path_clone.lock().unwrap() = Some(trimmed.clone());
                }
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

    // Solo se limpia el PID: la entrada (y su flag cancelled) vive hasta
    // que start() llame a finish(), cubriendo el posible reintento.
    registry.clear_pid(url);

    let error_text = last_error.lock().unwrap().clone();
    let file_path = final_path.lock().unwrap().clone();
    Ok((exit_ok, error_text, file_path))
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---------- classify_error ----------

    #[test]
    fn classify_error_detecta_cada_patron_de_auth() {
        let patrones = [
            "Sign in to confirm you're not a bot",
            "This video is available to this channel's members on level: X",
            "Join this channel to get access to members-only content",
            "The provided YouTube account cookies are no longer valid",
            "Please sign in to view this video",
            "confirm you are not a bot",
            "HTTP Error 401: Unauthorized",
        ];
        for p in patrones {
            assert_eq!(
                classify_error(p),
                Some("auth"),
                "patrón no clasificado como auth: {}",
                p
            );
        }
    }

    #[test]
    fn classify_error_es_case_insensitive() {
        assert_eq!(classify_error("SIGN IN TO CONFIRM your age"), Some("auth"));
        assert_eq!(classify_error("http ERROR 403: FORBIDDEN"), Some("cache"));
    }

    #[test]
    fn classify_error_detecta_cache_por_403_y_forbidden() {
        assert_eq!(classify_error("HTTP Error 403: Forbidden"), Some("cache"));
        assert_eq!(
            classify_error("unable to download: Forbidden"),
            Some("cache")
        );
        assert_eq!(
            classify_error("fragment 3 not found, HTTP error 403"),
            Some("cache")
        );
    }

    #[test]
    fn classify_error_auth_tiene_prioridad_sobre_cache() {
        // Un error que menciona ambos: la sesión inválida es la causa raíz.
        assert_eq!(
            classify_error("HTTP Error 401 then forbidden"),
            Some("auth")
        );
    }

    #[test]
    fn classify_error_devuelve_none_para_otros_errores() {
        assert_eq!(classify_error("Video unavailable"), None);
        assert_eq!(classify_error("HTTP Error 404: Not Found"), None);
        assert_eq!(classify_error(""), None);
    }

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
    fn expected_final_paths_videoonly_solo_la_simulada() {
        let paths = expected_final_paths(Path::new("C:/dl/video.webm"), &opciones("videoonly"));
        assert_eq!(paths, vec![PathBuf::from("C:/dl/video.webm")]);
    }
}
