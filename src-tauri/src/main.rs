#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod core;
mod features;

use tauri::Manager;

use crate::core::process::DownloadRegistry;
use features::{download, library, preview, session, settings, setup};

fn main() {
    tauri::Builder::default()
        // Single registry of active downloads (PID + cancelled flag per URL),
        // accessible via State<DownloadRegistry> in commands and services.
        .manage(DownloadRegistry::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            session::commands::open_youtube_login,
            session::commands::refresh_session_silent,
            session::commands::get_session_status,
            session::commands::get_account_info,
            session::commands::logout,
            settings::commands::open_downloads_folder,
            settings::commands::get_download_folder,
            settings::commands::set_download_folder,
            settings::commands::get_settings,
            settings::commands::set_settings,
            download::commands::start_download,
            download::commands::cancel_download,
            preview::commands::analyze_urls,
            library::commands::get_history,
            library::commands::add_history,
            library::commands::remove_history_item,
            library::commands::delete_history_file,
            library::commands::clear_history,
            library::commands::open_history_folder,
            setup::commands::check_dependencies,
            setup::commands::download_dependencies,
        ])
        .setup(|app| {
            let app_dir = core::paths::app_dir(app.handle());
            core::fsx::clean_stale_temps(&app_dir);
            core::ytdlp::clean_stale_run_cookies(&app_dir);
            Ok(())
        })
        .on_window_event(|window, event| {
            // On main window close, kill in-flight downloads (yt-dlp/ffmpeg) and any login
            // window, so neither orphan processes nor a hidden webview outlive the app.
            if window.label() == "main" {
                if let tauri::WindowEvent::Destroyed = event {
                    let app = window.app_handle();
                    app.state::<DownloadRegistry>().kill_all();
                    for label in ["youtube-login", "youtube-login-silent"] {
                        if let Some(w) = app.get_webview_window(label) {
                            w.close().ok();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}
