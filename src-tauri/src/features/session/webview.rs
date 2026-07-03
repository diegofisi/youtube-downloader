//! Extracción de cookies desde el webview de login y volcado a cookies.txt
//! (formato Netscape). Par natural del parser de `service`: aquí se
//! serializa lo que `service::parse_netscape` luego lee.

use tauri::webview::WebviewWindow;
use tauri::{AppHandle, Url};

use super::service;
use crate::core::{fsx, paths};

/// Lee las cookies del webview (varios dominios de Google/YouTube, incluidas
/// las HttpOnly) y las guarda en cookies.txt. Devuelve cuántas se guardaron.
pub fn extract_and_save_cookies(
    webview_window: &WebviewWindow,
    app: &AppHandle,
) -> Result<usize, String> {
    // Consultar varios dominios para capturar TODAS las cookies de sesion
    // (incluidas las HttpOnly como LOGIN_INFO, SID, __Secure-3PSID...).
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

    for raw in urls {
        let url: Url = match raw.parse() {
            Ok(u) => u,
            Err(_) => continue,
        };
        let cookies = webview_window.cookies_for_url(url).unwrap_or_default();

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

            // Las cookies HttpOnly llevan el prefijo #HttpOnly_ (formato yt-dlp).
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

    // Única fuente de la ruta (antes commands hacía join("cookies.txt") a mano)
    // + escritura atómica: nunca un cookies.txt a medias si algo muere aquí.
    let cookies_path = service::get_cookies_path(&paths::app_dir(app));
    fsx::write_atomic(&cookies_path, &output)
        .map_err(|e| format!("No se pudo escribir cookies.txt: {}", e))?;

    Ok(count)
}
