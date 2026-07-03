use std::io::Write;
use tauri::webview::{PageLoadEvent, WebviewWindowBuilder};
use tauri::{AppHandle, Emitter, Manager, Url};

use super::models::CookieResult;
use super::service;
use crate::core::paths;

#[tauri::command]
pub fn check_cookies(app: AppHandle) -> CookieResult {
    let app_dir = paths::app_dir(&app);
    service::check(&app_dir)
}

#[tauri::command]
pub fn load_cookies(app: AppHandle, path: String) -> CookieResult {
    let app_dir = paths::app_dir(&app);
    service::load(&app_dir, &path)
}

#[tauri::command]
pub fn get_session_status(app: AppHandle) -> String {
    let app_dir = paths::app_dir(&app);
    service::session_status(&app_dir).to_string()
}

#[tauri::command]
pub fn logout(app: AppHandle) -> Result<(), String> {
    let app_dir = paths::app_dir(&app);
    service::logout(&app_dir)
}

#[tauri::command]
pub async fn open_youtube_login(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("youtube-login") {
        existing.set_focus().ok();
        return Ok(());
    }

    let login_url: Url = "https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2F"
        .parse()
        .map_err(|e| format!("URL inválida: {}", e))?;

    let _login_window = WebviewWindowBuilder::new(
        &app,
        "youtube-login",
        tauri::WebviewUrl::External(login_url),
    )
    .title("YouTube - Iniciar sesion")
    .inner_size(1000.0, 700.0)
    .center()
    .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
    .on_page_load(|webview_window, payload| {
        if payload.event() == PageLoadEvent::Finished {
            let url = payload.url().to_string();

            if url.contains("youtube.com") && !url.contains("accounts.google.com") {
                let ww = webview_window.clone();
                let app_handle = webview_window.app_handle().clone();

                tauri::async_runtime::spawn(async move {
                    match extract_and_save_cookies(&ww, &app_handle).await {
                        Ok(count) => {
                            println!("[login] {} cookies guardadas", count);
                            app_handle.emit("cookies-extracted", true).ok();
                            ww.close().ok();
                        }
                        Err(e) => {
                            eprintln!("[login] Error extrayendo cookies: {}", e);
                            app_handle.emit("cookies-extracted", false).ok();
                        }
                    }
                });
            }
        }
    })
    .build()
    .map_err(|e| format!("No se pudo crear ventana de login: {}", e))?;

    Ok(())
}

async fn extract_and_save_cookies(
    webview_window: &tauri::webview::WebviewWindow,
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

    let app_dir = paths::app_dir(app);
    let cookies_path = app_dir.join("cookies.txt");

    let mut file = std::fs::File::create(&cookies_path)
        .map_err(|e| format!("No se pudo crear cookies.txt: {}", e))?;
    file.write_all(output.as_bytes())
        .map_err(|e| format!("No se pudo escribir cookies.txt: {}", e))?;

    Ok(count)
}
