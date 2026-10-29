//! Recent documents in the operating system: the Dock menu and File > Open Recent on macOS, the
//! Jump List "Recent" category on Windows and the shared recently-used list on Linux. The OS
//! calls are made on the main thread, which is where AppKit and GTK require them.

use tauri::AppHandle;

use crate::error::{AppError, AppResult, ErrorKind};

#[cfg(target_os = "macos")]
mod platform {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSDocumentController;
    use objc2_foundation::{NSString, NSURL};

    /// Needs the document types declared in the bundle (CFBundleDocumentTypes) to show in the Dock.
    pub fn add(path: &str) {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let url = NSURL::fileURLWithPath(&NSString::from_str(path));
        NSDocumentController::sharedDocumentController(mtm).noteNewRecentDocumentURL(&url);
    }

    pub fn clear() {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        // SAFETY: a nil sender is what the documentation allows.
        unsafe { NSDocumentController::sharedDocumentController(mtm).clearRecentDocuments(None) };
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use std::ffi::c_void;

    use windows::Win32::UI::Shell::{SHARD_PATHW, SHARD_PIDL, SHAddToRecentDocs};

    use super::wide_path;

    /// The Jump List of the app lists it once the file type is registered to the app (installer).
    pub fn add(path: &str) {
        let wide = wide_path(path);
        // SAFETY: `wide` is a NUL-terminated UTF-16 string that outlives the call.
        unsafe { SHAddToRecentDocs(SHARD_PATHW.0 as u32, Some(wide.as_ptr() as *const c_void)) };
    }

    pub fn clear() {
        // SAFETY: a null item with SHARD_PIDL clears the list.
        unsafe { SHAddToRecentDocs(SHARD_PIDL.0 as u32, None) };
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use gtk::glib;
    use gtk::prelude::RecentManagerExt;

    use super::file_url;

    pub fn add(path: &str) {
        gtk::RecentManager::default().add_item(&file_url(path));
    }

    /// Removes only the entries this app added; other apps' entries stay.
    pub fn clear() {
        let manager = gtk::RecentManager::default();
        let Some(app_name) = glib::application_name() else {
            return;
        };
        for item in manager.items() {
            if let (true, Some(uri)) = (item.has_application(&app_name), item.uri()) {
                let _ = manager.remove_item(&uri);
            }
        }
    }
}

/// `file://` URI of an absolute path, percent-encoding everything but unreserved characters.
#[cfg(any(target_os = "linux", test))]
fn file_url(path: &str) -> String {
    let mut url = String::from("file://");
    for byte in path.replace('\\', "/").bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b'/' => {
                url.push(byte as char)
            }
            _ => url.push_str(&format!("%{byte:02X}")),
        }
    }
    url
}

/// UTF-16 with the terminating NUL that Win32 path parameters expect.
#[cfg(any(target_os = "windows", test))]
fn wide_path(path: &str) -> Vec<u16> {
    path.encode_utf16().chain(std::iter::once(0)).collect()
}

fn on_main_thread(app: &AppHandle, work: impl FnOnce() + Send + 'static) -> AppResult<()> {
    app.run_on_main_thread(work)
        .map_err(|error| AppError::new(ErrorKind::Io, error.to_string()))
}

/// Tells the OS the document was opened or saved, so it lists it among the recent ones.
#[tauri::command]
pub async fn add_os_recent(app: AppHandle, path: String) -> AppResult<()> {
    if path.is_empty() {
        return Err(AppError::invalid_input("path must not be empty"));
    }
    on_main_thread(&app, move || platform::add(&path))
}

/// Empties the OS list of recent documents (on Linux only this app's entries).
#[tauri::command]
pub async fn clear_os_recents(app: AppHandle) -> AppResult<()> {
    on_main_thread(&app, platform::clear)
}

#[cfg(test)]
mod tests {
    use super::{file_url, wide_path};

    #[test]
    fn file_url_keeps_unreserved_characters_and_slashes() {
        assert_eq!(
            file_url("/home/a/notes-1_v2.md"),
            "file:///home/a/notes-1_v2.md"
        );
    }

    #[test]
    fn file_url_encodes_spaces_and_reserved_characters() {
        assert_eq!(file_url("/a b/c#d?.md"), "file:///a%20b/c%23d%3F.md");
    }

    #[test]
    fn file_url_encodes_unicode_as_utf8_bytes() {
        assert_eq!(file_url("/ñ.md"), "file:///%C3%B1.md");
    }

    #[test]
    fn file_url_turns_backslashes_into_slashes() {
        assert_eq!(file_url("\\a\\b.md"), "file:///a/b.md");
    }

    #[test]
    fn wide_path_is_utf16_with_a_terminating_nul() {
        assert_eq!(wide_path("a.md"), vec![97, 46, 109, 100, 0]);
    }

    #[test]
    fn wide_path_encodes_characters_outside_the_bmp_as_surrogate_pairs() {
        assert_eq!(wide_path("😀"), vec![0xD83D, 0xDE00, 0]);
    }

    #[test]
    fn wide_path_of_nothing_is_just_the_nul() {
        assert_eq!(wide_path(""), vec![0]);
    }
}
