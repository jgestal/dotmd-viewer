//! macOS-only window decorations the JS API lacks: the proxy icon (represented filename), the
//! "edited" dot in the close button and the title bar's light or dark look. Everywhere else this
//! is a no-op.

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

#[cfg(target_os = "macos")]
fn apply_title_bar_scheme(window: &WebviewWindow, dark: bool) -> AppResult<()> {
    use objc2_app_kit::{
        NSAppearance, NSAppearanceCustomization, NSAppearanceNameAqua, NSAppearanceNameDarkAqua,
        NSWindow,
    };

    let ns_window = window
        .ns_window()
        .map_err(|error| AppError::invalid_input(error.to_string()))?;
    // SAFETY: Tauri hands out the live NSWindow of this window, and this runs on the main thread.
    let ns_window: &NSWindow = unsafe { &*ns_window.cast() };
    // The window, not the app, gets the appearance: NSApp keeps following the system, so the
    // window's theme events still report the system's choice.
    // SAFETY: the appearance names are AppKit constants.
    let name = unsafe {
        if dark {
            NSAppearanceNameDarkAqua
        } else {
            NSAppearanceNameAqua
        }
    };
    ns_window.setAppearance(NSAppearance::appearanceNamed(name).as_deref());
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn apply_title_bar_scheme(_window: &WebviewWindow, _dark: bool) -> AppResult<()> {
    Ok(())
}

/// Draws the window light or dark to match the page (macOS only): on macOS 26 the system
/// otherwise draws a dark title over a dark page.
#[tauri::command]
pub fn set_title_bar_scheme(window: WebviewWindow, dark: bool) -> AppResult<()> {
    let target = window.clone();
    window
        .run_on_main_thread(move || {
            let _ = apply_title_bar_scheme(&target, dark);
        })
        .map_err(|error| AppError::invalid_input(error.to_string()))
}
