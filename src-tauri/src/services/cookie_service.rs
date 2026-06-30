use std::fs;
use std::path::{Path, PathBuf};

use crate::models::CookieResult;

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

    // Copy to app directory if different path
    if source.canonicalize().ok() != cookies_path.canonicalize().ok() {
        if let Err(e) = fs::copy(source, &cookies_path) {
            return CookieResult {
                status: "error".to_string(),
                path: None,
                message: Some(format!("No se pudo copiar el archivo: {}", e)),
            };
        }
    }

    // Validate
    match fs::read_to_string(&cookies_path) {
        Ok(content) => {
            let status = validate_cookie_content(&content);
            CookieResult::new(status).with_path(&cookies_path.to_string_lossy())
        }
        Err(_) => CookieResult::new("error"),
    }
}
