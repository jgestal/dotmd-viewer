//! DotMD Viewer backend: file access, Markdown rendering and OS integration, exposed to the
//! frontend as Tauri commands. Each feature lives in its own module; this file only wires them.

mod drag_out;
pub mod error;
mod file_ops;
mod files;
mod folders;
mod open_requests;
mod os_recents;
mod preferences_file;
mod printing;
mod quit;
mod render;
mod watcher;
mod window_state;

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
        // Size, position and maximised state are restored before the window is shown; the
        // frontend reveals it once started (see `AppWindow.reveal`), so VISIBLE is not restored.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        & !tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drag::init())
        .manage(OpenRequests::with_pending(launch_paths))
        .manage(watcher::WatcherState::default())
        .manage(quit::QuitState::default())
        .invoke_handler(tauri::generate_handler![
            // Commands are registered here, one line per command.
            render::render_markdown,
            files::read_file,
            files::write_file,
            folders::list_dir,
            open_requests::take_pending_open,
            watcher::watch_file,
            file_ops::path_exists,
            file_ops::path_kind,
            file_ops::rename_path,
            file_ops::trash_path,
            file_ops::copy_into,
            file_ops::ensure_dir_path,
            file_ops::reveal_path,
            preferences_file::load_preferences,
            preferences_file::save_preferences,
            window_state::set_document_state,
            quit::quit_app,
            drag_out::drag_icon,
            printing::print_page,
            printing::export_pdf,
            os_recents::add_os_recent,
            os_recents::clear_os_recents,
        ])
        .setup(|app| {
            show_window_if_frontend_stalls(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building DotMD Viewer");

    app.run(|app, event| {
        // Quit from the Dock, Cmd+Q or the last window closing: ask the frontend first.
        if let tauri::RunEvent::ExitRequested { code, api, .. } = &event
            && quit::hold_exit(app, *code)
        {
            api.prevent_exit();
        }
        // Finder double-click and "Open With" arrive as an event, even on a cold start.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            let paths = urls
                .iter()
                .filter_map(|url| url.to_file_path().ok())
                .map(|path| path.to_string_lossy().into_owned())
                .collect();
            open_requests::deliver(app, paths);
        }
    });
}

/// The window starts hidden and the frontend shows it once the first view is painted. If the
/// frontend fails before that, show it anyway so the app never looks like it did not start.
fn show_window_if_frontend_stalls(app: tauri::AppHandle) {
    use tauri::Manager;
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        if let Some(window) = app.get_webview_window("main")
            && !window.is_visible().unwrap_or(true)
        {
            let _ = window.show();
        }
    });
}
