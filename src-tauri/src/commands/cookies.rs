use std::io::Write;
use tauri::webview::{PageLoadEvent, WebviewWindowBuilder};
use tauri::{AppHandle, Emitter, Manager, Url};

use crate::models::CookieResult;
use crate::services::{config_service, cookie_service};

fn get_app_dir(app: &AppHandle) -> std::path::PathBuf {
    if cfg!(debug_assertions) {
        let exe_path = std::env::current_exe().unwrap();
        let exe_dir = exe_path.parent().unwrap();
        let mut dir = exe_dir.to_path_buf();
        for _ in 0..5 {
            if dir.join("tauri.conf.json").exists() {
                return dir.parent().unwrap().to_path_buf();
            }
            if dir.join("src-tauri").exists() {
                return dir.to_path_buf();
            }
            if let Some(parent) = dir.parent() {
                dir = parent.to_path_buf();
            } else {
                break;
            }
        }
        app.path().resource_dir().unwrap_or(exe_dir.to_path_buf())
    } else {
        let data_dir = app
            .path()
            .app_local_data_dir()
            .expect("No se pudo obtener directorio de datos de la app");
        std::fs::create_dir_all(&data_dir).ok();
        data_dir
    }
}

#[tauri::command]
pub fn check_cookies(app: AppHandle) -> CookieResult {
    let app_dir = get_app_dir(&app);
    cookie_service::check(&app_dir)
}

#[tauri::command]
pub fn load_cookies(app: AppHandle, path: String) -> CookieResult {
    let app_dir = get_app_dir(&app);
    cookie_service::load(&app_dir, &path)
}

#[tauri::command]
pub async fn open_youtube_login(app: AppHandle) -> Result<(), String> {
    // If the login window already exists, focus it
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

            // User landed on youtube.com after login
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
    let youtube_url: Url = "https://www.youtube.com".parse().unwrap();
    let google_url: Url = "https://www.google.com".parse().unwrap();

    // Get cookies for YouTube and Google domains (includes HttpOnly!)
    let yt_cookies = webview_window
        .cookies_for_url(youtube_url)
        .map_err(|e| format!("Error obteniendo cookies de YouTube: {}", e))?;

    let google_cookies = webview_window
        .cookies_for_url(google_url)
        .unwrap_or_default();

    let mut output = String::from("# Netscape HTTP Cookie File\n");
    output.push_str("# Generado por YouTube Downloader (WebView login)\n\n");

    let mut count = 0;

    for cookie in yt_cookies.iter().chain(google_cookies.iter()) {
        let domain = cookie.domain().unwrap_or(".youtube.com");
        let flag = if domain.starts_with('.') {
            "TRUE"
        } else {
            "FALSE"
        };
        let path = cookie.path().unwrap_or("/");
        let secure = if cookie.secure().unwrap_or(false) {
            "TRUE"
        } else {
            "FALSE"
        };
        let expiry = match cookie.expires() {
            Some(exp) => match exp {
                cookie::Expiration::DateTime(dt) => dt.unix_timestamp().to_string(),
                cookie::Expiration::Session => "0".to_string(),
            },
            None => "0".to_string(),
        };

        output.push_str(&format!(
            "{}\t{}\t{}\t{}\t{}\t{}\t{}\n",
            domain,
            flag,
            path,
            secure,
            expiry,
            cookie.name(),
            cookie.value()
        ));
        count += 1;
    }

    // Save to cookies.txt
    let app_dir = get_app_dir(app);
    let cookies_path = app_dir.join("cookies.txt");

    let mut file = std::fs::File::create(&cookies_path)
        .map_err(|e| format!("No se pudo crear cookies.txt: {}", e))?;
    file.write_all(output.as_bytes())
        .map_err(|e| format!("No se pudo escribir cookies.txt: {}", e))?;

    Ok(count)
}

#[tauri::command]
pub fn open_downloads_folder(app: AppHandle) {
    let app_dir = get_app_dir(&app);
    let downloads = config_service::get_download_folder(&app_dir);
    std::fs::create_dir_all(&downloads).ok();

    let path = downloads.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .ok();
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .ok();
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .ok();
    }
}

#[tauri::command]
pub fn get_download_folder(app: AppHandle) -> String {
    let app_dir = get_app_dir(&app);
    let folder = config_service::get_download_folder(&app_dir);
    folder.to_string_lossy().to_string()
}

#[tauri::command]
pub fn set_download_folder(app: AppHandle, folder: String) -> Result<String, String> {
    let app_dir = get_app_dir(&app);
    let path = std::path::Path::new(&folder);
    std::fs::create_dir_all(path).map_err(|e| format!("No se pudo crear la carpeta: {}", e))?;
    config_service::set_download_folder(&app_dir, &folder)?;
    Ok(folder)
}

pub fn app_dir(app: &AppHandle) -> std::path::PathBuf {
    get_app_dir(app)
}
