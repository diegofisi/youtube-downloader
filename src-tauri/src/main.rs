#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod core;
mod features;

use features::{download, session, settings, setup};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            session::commands::check_cookies,
            session::commands::load_cookies,
            session::commands::open_youtube_login,
            settings::commands::open_downloads_folder,
            settings::commands::get_download_folder,
            settings::commands::set_download_folder,
            download::commands::start_download,
            download::commands::cancel_download,
            setup::commands::check_dependencies,
            setup::commands::download_dependencies,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}
