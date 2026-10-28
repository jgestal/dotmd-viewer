//! DotMD Viewer backend: file access, Markdown rendering and OS integration, exposed to the
//! frontend as Tauri commands. Each feature lives in its own module; this file only wires them.

pub mod error;
mod files;
mod folders;
mod open_requests;
mod render;
mod watcher;

use open_requests::OpenRequests;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cwd = std::env::current_dir().unwrap_or_default();
    let launch_paths = open_requests::paths_from_args(std::env::args().skip(1), &cwd);

    let app = tauri::Builder::default()
        // Registered first, so a second launch exits before any other plugin starts.
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            open_requests::on_second_instance(app, argv, cwd)
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(OpenRequests::with_pending(launch_paths))
        .manage(watcher::WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            // Commands are registered here, one line per command.
            render::render_markdown,
            files::read_file,
            files::write_file,
            folders::list_dir,
            open_requests::take_pending_open,
            watcher::watch_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building DotMD Viewer");

    app.run(|_app, _event| {
        // Finder double-click and "Open With" arrive as an event, even on a cold start.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = _event {
            let paths = urls
                .iter()
                .filter_map(|url| url.to_file_path().ok())
                .map(|path| path.to_string_lossy().into_owned())
                .collect();
            open_requests::deliver(_app, paths);
        }
    });
}
