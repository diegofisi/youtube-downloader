//! Cookie extraction from the login webview into cookies.txt (Netscape
//! format) — the write-side counterpart of `service::parse_netscape`.

use tauri::webview::WebviewWindow;
use tauri::{AppHandle, Url};

use super::service;
use crate::core::{fsx, paths};

/// Reads webview cookies (several Google/YouTube domains, HttpOnly included) and saves them to
/// cookies.txt. Ok(None) = no valid YouTube auth cookie yet (file untouched); Ok(Some(n)) = saved.
pub fn extract_and_save_cookies(
    webview_window: &WebviewWindow,
    app: &AppHandle,
) -> Result<Option<usize>, String> {
    // Query several domains to capture ALL session cookies
    // (including HttpOnly ones like LOGIN_INFO, SID, __Secure-3PSID...).
    let urls = [
        "https://www.youtube.com",
        "https://youtube.com",
        "https://accounts.google.com",
        "https://www.google.com",
    ];

    let mut output = String::from("# Netscape HTTP Cookie File\n");
    output.push_str("# Generado por YouTube Downloader (WebView login)\n\n");

    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut count = 0;
    let mut read_errors = 0;

    for raw in urls {
        let url: Url = match raw.parse() {
            Ok(u) => u,
            Err(_) => continue,
        };
        let cookies = match webview_window.cookies_for_url(url) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[login] No se pudieron leer cookies de {}: {}", raw, e);
                read_errors += 1;
                continue;
            }
        };

        for cookie in cookies.iter() {
            let domain = cookie.domain().unwrap_or(".youtube.com");
            let path = cookie.path().unwrap_or("/");

            let key = format!("{}|{}|{}", domain, path, cookie.name());
            if !seen.insert(key) {
                continue;
            }

            let include_subdomains = if domain.starts_with('.') {
                "TRUE"
            } else {
                "FALSE"
            };
            let secure = if cookie.secure().unwrap_or(false) {
                "TRUE"
            } else {
                "FALSE"
            };
            let expiry = match cookie.expires() {
                Some(cookie::Expiration::DateTime(dt)) => dt.unix_timestamp().to_string(),
                _ => "0".to_string(),
            };

            // HttpOnly cookies carry the #HttpOnly_ prefix (yt-dlp format).
            let domain_field = if cookie.http_only().unwrap_or(false) {
                format!("#HttpOnly_{}", domain)
            } else {
                domain.to_string()
            };

            output.push_str(&format!(
                "{}\t{}\t{}\t{}\t{}\t{}\t{}\n",
                domain_field,
                include_subdomains,
                path,
                secure,
                expiry,
                cookie.name(),
                cookie.value()
            ));
            count += 1;
        }
    }

    if read_errors == urls.len() {
        return Err("El navegador no devolvió cookies (ventana cerrada?)".into());
    }
    // Mid-login hops (accounts.youtube.com) and anonymous pages carry no auth cookie:
    // saving them would overwrite a valid session with junk.
    if !service::has_valid_auth(&output) {
        return Ok(None);
    }

    // Single source of the path + atomic write: never a half-written
    // cookies.txt if something dies here.
    let cookies_path = service::get_cookies_path(&paths::app_dir(app));
    fsx::write_atomic(&cookies_path, &output)
        .map_err(|e| format!("No se pudo escribir cookies.txt: {}", e))?;

    Ok(Some(count))
}
