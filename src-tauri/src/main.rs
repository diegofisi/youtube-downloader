#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod core;
mod features;

use features::{download, library, preview, session, settings, setup};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            session::commands::check_cookies,
            session::commands::load_cookies,
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
            preview::commands::get_video_metadata,
            library::commands::get_history,
            library::commands::add_history,
            library::commands::remove_history_item,
            library::commands::delete_history_file,
            library::commands::clear_history,
            library::commands::open_history_folder,
            setup::commands::check_dependencies,
            setup::commands::download_dependencies,
        ])
        .on_window_event(|window, event| {
            // Al cerrar la ventana principal, matar descargas en curso (yt-dlp/ffmpeg)
            // para no dejar procesos huérfanos descargando en segundo plano.
            if window.label() == "main" {
                if let tauri::WindowEvent::Destroyed = event {
                    core::process::kill_all();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}
