use tauri::webview::{PageLoadEvent, WebviewWindowBuilder};
use tauri::{AppHandle, Emitter, Manager, Url};

use super::models::AccountInfo;
use super::service;
use super::webview::extract_and_save_cookies;
use crate::core::paths;

#[tauri::command]
pub fn get_session_status(app: AppHandle) -> String {
    let app_dir = paths::app_dir(&app);
    service::session_status(&app_dir).to_string()
}

#[tauri::command]
pub async fn get_account_info(app: AppHandle) -> Result<Option<AccountInfo>, String> {
    let app_dir = paths::app_dir(&app);
    // spawn_blocking: uses reqwest::blocking; must not run on the async runtime.
    tauri::async_runtime::spawn_blocking(move || service::get_account_info(&app_dir))
        .await
        .map_err(|e| format!("Error interno consultando la cuenta: {}", e))?
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
    .user_agent(service::BROWSER_UA)
    .on_page_load(|webview_window, payload| {
        if payload.event() == PageLoadEvent::Finished {
            let url = payload.url().to_string();

            if url.contains("youtube.com") && !url.contains("accounts.google.com") {
                let ww = webview_window.clone();
                let app_handle = webview_window.app_handle().clone();

                tauri::async_runtime::spawn(async move {
                    match extract_and_save_cookies(&ww, &app_handle) {
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

/// Refreshes the YouTube session WITHOUT user interaction: a hidden window loads the passive login URL; if Google's session is still alive it redirects straight to youtube.com and fresh cookies are re-extracted.
/// Still on accounts.google.com after ~20s (interaction required) resolves `false`.
#[tauri::command]
pub async fn refresh_session_silent(app: AppHandle) -> Result<bool, String> {
    const LABEL: &str = "youtube-login-silent";

    // Avoid duplicates: close any leftover window before retrying.
    if let Some(existing) = app.get_webview_window(LABEL) {
        existing.close().ok();
    }

    let login_url: Url = "https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2F"
        .parse()
        .map_err(|e| format!("URL inválida: {}", e))?;

    // Channel to await the result from the on_page_load callback.
    // The Sender sits in a Mutex<Option<..>> so it's consumed exactly once.
    let (tx, rx) = std::sync::mpsc::channel::<bool>();
    let tx = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
    let tx_for_cb = std::sync::Arc::clone(&tx);

    let build_result =
        WebviewWindowBuilder::new(&app, LABEL, tauri::WebviewUrl::External(login_url))
            .title("YouTube - Reconexion silenciosa")
            .inner_size(1000.0, 700.0)
            .visible(false)
            .user_agent(service::BROWSER_UA)
            .on_page_load(move |webview_window, payload| {
                if payload.event() == PageLoadEvent::Finished {
                    let url = payload.url().to_string();

                    if url.contains("youtube.com") && !url.contains("accounts.google.com") {
                        // Landed on YouTube without interaction: the session is still alive.
                        let sender = tx_for_cb.lock().unwrap().take();
                        let Some(sender) = sender else { return };

                        let ww = webview_window.clone();
                        let app_handle = webview_window.app_handle().clone();

                        tauri::async_runtime::spawn(async move {
                            let ok = match extract_and_save_cookies(&ww, &app_handle) {
                                Ok(count) => {
                                    println!(
                                        "[silent-login] {} cookies refrescadas sin interacción",
                                        count
                                    );
                                    app_handle.emit("cookies-extracted", true).ok();
                                    true
                                }
                                Err(e) => {
                                    eprintln!("[silent-login] Error extrayendo cookies: {}", e);
                                    false
                                }
                            };
                            sender.send(ok).ok();
                        });
                    }
                }
            })
            .build();

    if let Err(e) = build_result {
        return Err(format!(
            "No se pudo crear ventana de login silencioso: {}",
            e
        ));
    }

    // Wait for the result with a ~20s timeout without blocking the async runtime.
    let outcome = tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(std::time::Duration::from_secs(20))
    })
    .await;

    let success = match outcome {
        Ok(Ok(ok)) => ok,
        // Timeout or closed channel: never landed on youtube.com (interaction required).
        _ => {
            println!("[silent-login] Timeout: la sesión de Google requiere interacción");
            false
        }
    };

    // Invalidate the sender so a late landing does no extra work.
    tx.lock().unwrap().take();

    if let Some(win) = app.get_webview_window(LABEL) {
        win.close().ok();
    }

    Ok(success)
}
