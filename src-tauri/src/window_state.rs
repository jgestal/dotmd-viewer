//! macOS-only window decorations the JS API lacks: the proxy icon (represented filename) and the
//! "edited" dot in the close button. Everywhere else this is a no-op.

use tauri::WebviewWindow;

use crate::error::{AppError, AppResult};

#[cfg(target_os = "macos")]
fn apply(window: &WebviewWindow, path: Option<&str>, edited: bool) -> AppResult<()> {
    use objc2_app_kit::NSWindow;
    use objc2_foundation::NSString;

    let ns_window = window
        .ns_window()
        .map_err(|error| AppError::invalid_input(error.to_string()))?;
    // SAFETY: Tauri hands out the live NSWindow of this window, and this runs on the main thread.
    let ns_window: &NSWindow = unsafe { &*ns_window.cast() };
    ns_window.setRepresentedFilename(&NSString::from_str(path.unwrap_or("")));
    ns_window.setDocumentEdited(edited);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn apply(_window: &WebviewWindow, _path: Option<&str>, _edited: bool) -> AppResult<()> {
    Ok(())
}

/// Shows `path` as the window's proxy icon and the edited dot when `edited` (macOS only).
#[tauri::command]
pub fn set_document_state(
    window: WebviewWindow,
    path: Option<String>,
    edited: bool,
) -> AppResult<()> {
    let target = window.clone();
    window
        .run_on_main_thread(move || {
            let _ = apply(&target, path.as_deref(), edited);
        })
        .map_err(|error| AppError::invalid_input(error.to_string()))
}
