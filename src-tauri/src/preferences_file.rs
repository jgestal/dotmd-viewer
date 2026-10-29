//! The preferences file in the app config directory. The frontend owns its shape: this module
//! only stores the JSON text atomically and hands it back parsed.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::error::{AppError, AppResult};
use crate::files::write_atomically;

const FILE_NAME: &str = "preferences.json";

fn config_path(app: &AppHandle) -> AppResult<PathBuf> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| AppError::io(io::Error::other(error.to_string()), Path::new("")))?;
    Ok(directory.join(FILE_NAME))
}

/// The stored JSON, or `None` when nothing was saved yet.
pub fn load(path: &Path) -> AppResult<Option<Value>> {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(AppError::io(error, path)),
    };
    serde_json::from_str(&text)
        .map(Some)
        .map_err(|error| AppError::invalid_input(error.to_string()).with_path(path))
}

/// Writes `serialised` (which must be valid JSON), creating the directory when needed.
pub fn save(path: &Path, serialised: &str) -> AppResult<()> {
    serde_json::from_str::<Value>(serialised)
        .map_err(|error| AppError::invalid_input(error.to_string()))?;
    if let Some(directory) = path.parent() {
        fs::create_dir_all(directory).map_err(|error| AppError::io(error, directory))?;
    }
    write_atomically(path, serialised.as_bytes())
}

#[tauri::command]
pub async fn load_preferences(app: AppHandle) -> AppResult<Option<Value>> {
    load(&config_path(&app)?)
}

#[tauri::command]
pub async fn save_preferences(app: AppHandle, serialised: String) -> AppResult<()> {
    save(&config_path(&app)?, &serialised)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorKind;
    use tempfile::TempDir;

    #[test]
    fn loading_before_any_save_gives_nothing() {
        let dir = TempDir::new().unwrap();
        assert_eq!(load(&dir.path().join(FILE_NAME)).unwrap(), None);
    }

    #[test]
    fn a_file_that_cannot_be_read_is_an_error_not_an_empty_load() {
        let dir = TempDir::new().unwrap();
        let error = load(dir.path()).unwrap_err();
        assert_eq!(error.path.as_deref(), dir.path().to_str());
    }

    #[test]
    fn saved_preferences_load_back_as_parsed_json() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("config").join(FILE_NAME);
        save(&path, r#"{"theme":"dark"}"#).unwrap();
        assert_eq!(
            load(&path).unwrap(),
            Some(serde_json::json!({ "theme": "dark" }))
        );
    }

    #[test]
    fn saving_replaces_the_previous_content() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join(FILE_NAME);
        save(&path, r#"{"a":1}"#).unwrap();
        save(&path, r#"{"a":2}"#).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), r#"{"a":2}"#);
    }

    #[test]
    fn invalid_json_is_refused_on_save_and_reported_on_load() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join(FILE_NAME);
        assert_eq!(
            save(&path, "{oops").unwrap_err().kind,
            ErrorKind::InvalidInput
        );
        assert!(!path.exists());
        fs::write(&path, "{oops").unwrap();
        let error = load(&path).unwrap_err();
        assert_eq!(error.kind, ErrorKind::InvalidInput);
        assert_eq!(error.path.as_deref(), path.to_str());
    }
}
