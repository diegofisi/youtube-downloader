#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::cookies::check_cookies,
            commands::cookies::load_cookies,
            commands::cookies::open_youtube_login,
            commands::cookies::open_downloads_folder,
            commands::cookies::get_download_folder,
            commands::cookies::set_download_folder,
            commands::download::start_download,
            commands::download::cancel_download,
            commands::setup::check_dependencies,
            commands::setup::download_dependencies,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar la aplicación");
}
