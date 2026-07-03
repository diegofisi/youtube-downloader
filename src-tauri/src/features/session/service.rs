use std::fs;
use std::path::{Path, PathBuf};

use super::models::CookieResult;

pub fn get_cookies_path(app_dir: &Path) -> PathBuf {
    app_dir.join("cookies.txt")
}

pub fn validate_cookie_content(content: &str) -> &'static str {
    let has_header = content.contains("# Netscape HTTP Cookie File")
        || content.contains("# HTTP Cookie File");

    // Cookies que indican una sesion iniciada en YouTube/Google.
    let has_auth = ["LOGIN_INFO", "SAPISID", "__Secure-3PSID", "__Secure-1PSID"]
        .iter()
        .any(|name| content.contains(name));

    if content.contains("youtube.com") || has_auth {
        "youtube"
    } else if has_header {
        "generic"
    } else {
        "invalid"
    }
}

/// Estado REAL de la sesión de YouTube según cookies.txt:
/// - "connected": hay cookies de autenticación fuertes en `.youtube.com` y vigentes.
/// - "expired": hay cookies de YouTube pero la auth falta o venció (re-login necesario).
/// - "none": no hay archivo o no hay nada de YouTube.
///
/// Nota: exports del navegador suelen traer SAPISID solo en `.google.com`; yt-dlp
/// necesita la auth en `.youtube.com`, por eso se valida ese dominio en concreto.
pub fn session_status(app_dir: &Path) -> &'static str {
    let path = get_cookies_path(app_dir);
    let Ok(content) = fs::read_to_string(&path) else {
        return "none";
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    const STRONG: [&str; 4] = ["SAPISID", "__Secure-3PAPISID", "LOGIN_INFO", "SSID"];
    let mut has_any_yt = false;
    let mut strong_valid = false;
    let mut strong_expired = false;

    for raw in content.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        let line = line.strip_prefix("#HttpOnly_").unwrap_or(line);
        if line.starts_with('#') {
            continue;
        }
        let f: Vec<&str> = line.split('\t').collect();
        if f.len() < 7 {
            continue;
        }
        if !f[0].contains("youtube.com") {
            continue;
        }
        has_any_yt = true;
        let name = f[5];
        if STRONG.contains(&name) {
            let exp: i64 = f[4].parse().unwrap_or(0);
            if exp != 0 && exp < now {
                strong_expired = true;
            } else {
                strong_valid = true;
            }
        }
    }

    if strong_valid {
        "connected"
    } else if has_any_yt || strong_expired {
        "expired"
    } else {
        "none"
    }
}

/// Cierra la sesión eliminando cookies.txt.
pub fn logout(app_dir: &Path) -> Result<(), String> {
    let path = get_cookies_path(app_dir);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("No se pudo borrar cookies.txt: {}", e))?;
    }
    Ok(())
}

pub fn check(app_dir: &Path) -> CookieResult {
    let cookies_path = get_cookies_path(app_dir);

    if !cookies_path.exists() {
        return CookieResult::new("none");
    }

    match fs::read_to_string(&cookies_path) {
        Ok(content) => {
            let status = validate_cookie_content(&content);
            CookieResult::new(status).with_path(&cookies_path.to_string_lossy())
        }
        Err(_) => CookieResult::new("error"),
    }
}

pub fn load(app_dir: &Path, source_path: &str) -> CookieResult {
    let cookies_path = get_cookies_path(app_dir);
    let source = Path::new(source_path);

    if !source.exists() {
        return CookieResult {
            status: "error".to_string(),
            path: None,
            message: Some("El archivo no existe".to_string()),
        };
    }

    if source.canonicalize().ok() != cookies_path.canonicalize().ok() {
        if let Err(e) = fs::copy(source, &cookies_path) {
            return CookieResult {
                status: "error".to_string(),
                path: None,
                message: Some(format!("No se pudo copiar el archivo: {}", e)),
            };
        }
    }

    match fs::read_to_string(&cookies_path) {
        Ok(content) => {
            let status = validate_cookie_content(&content);
            CookieResult::new(status).with_path(&cookies_path.to_string_lossy())
        }
        Err(_) => CookieResult::new("error"),
    }
}
