//! Dragging files out of the app: the drag itself is done by `tauri-plugin-drag`; this module
//! only provides the small image shown under the cursor while the system carries the files.

use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

const ICON_FILE_NAME: &str = "simpledotmd-drag-icon.png";
const ICON_BYTES: &[u8] = include_bytes!("../icons/32x32.png");

/// Writes the drag image into `folder` (once) and returns its path.
fn ensure_icon(folder: &Path) -> AppResult<PathBuf> {
    let icon = folder.join(ICON_FILE_NAME);
    if !icon.exists() {
        std::fs::write(&icon, ICON_BYTES).map_err(|error| AppError::io(error, &icon))?;
    }
    Ok(icon)
}

/// Path of the image to show while dragging files out of the window.
#[tauri::command]
pub async fn drag_icon() -> AppResult<String> {
    ensure_icon(&std::env::temp_dir()).map(|icon| icon.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_the_icon_once_and_reuses_it() {
        let folder = tempfile::tempdir().unwrap();
        let first = ensure_icon(folder.path()).unwrap();
        assert_eq!(std::fs::read(&first).unwrap(), ICON_BYTES);
        std::fs::write(&first, b"changed").unwrap();
        assert_eq!(ensure_icon(folder.path()).unwrap(), first);
        assert_eq!(std::fs::read(&first).unwrap(), b"changed");
    }

    #[test]
    fn fails_when_the_folder_is_missing() {
        let folder = tempfile::tempdir().unwrap();
        assert!(ensure_icon(&folder.path().join("nope")).is_err());
    }
}
