//! DotMD Viewer backend: file access, Markdown rendering and OS integration, exposed to the
//! frontend as Tauri commands. Each feature lives in its own module; this file only wires them.

pub mod error;
mod files;
mod render;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Commands are registered here, one line per command.
            render::render_markdown,
            files::read_file,
            files::write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DotMD Viewer");
}
