//! Watches the open document and tells the frontend when another program changes it.
//!
//! The file's parent folder is watched, not the file itself: editors usually save by writing a
//! temporary file and renaming it over the original, which would kill a watch on the old inode.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{DebounceEventResult, Debouncer, new_debouncer};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::{AppError, AppResult, ErrorKind};
use crate::files::parent_directory;

const FILE_CHANGED_EVENT: &str = "file-changed";
const DEBOUNCE: Duration = Duration::from_millis(200);

type FileWatcher = Debouncer<RecommendedWatcher>;

/// The watcher of the single open file; dropping it stops watching.
#[derive(Default)]
pub struct WatcherState(Mutex<Option<FileWatcher>>);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileChanged {
    path: String,
}

/// The path events are reported with: the canonical parent (macOS reports `/private/var` for
/// `/var`) plus the file name, which may not exist any more when the file was removed.
fn event_target(path: &Path) -> AppResult<(PathBuf, PathBuf)> {
    let parent = parent_directory(path);
    let file_name = path
        .file_name()
        .ok_or_else(|| AppError::invalid_input("Not a file path").with_path(path))?;
    let parent = parent
        .canonicalize()
        .map_err(|error| AppError::io(error, parent))?;
    Ok((parent.join(file_name), parent))
}

/// Whether a batch of changed paths includes the watched file.
fn concerns(event_paths: &[PathBuf], target: &Path) -> bool {
    event_paths.iter().any(|path| path == target)
}

/// Starts watching `path`, calling `on_change` (debounced) whenever the file is modified,
/// replaced or removed.
fn watch(path: &Path, on_change: impl Fn() + Send + 'static) -> AppResult<FileWatcher> {
    let (target, parent) = event_target(path)?;
    let mut debouncer = new_debouncer(DEBOUNCE, move |result: DebounceEventResult| {
        if let Ok(events) = result {
            let paths: Vec<PathBuf> = events.into_iter().map(|event| event.path).collect();
            if concerns(&paths, &target) {
                on_change();
            }
        }
    })
    .map_err(watch_error)?;
    debouncer
        .watcher()
        .watch(&parent, RecursiveMode::NonRecursive)
        .map_err(watch_error)?;
    Ok(debouncer)
}

fn watch_error(error: notify_debouncer_mini::notify::Error) -> AppError {
    AppError::new(ErrorKind::Io, error.to_string())
}

fn replace_watcher(
    state: &WatcherState,
    path: Option<&Path>,
    on_change: impl Fn() + Send + 'static,
) -> AppResult<()> {
    let watcher = path.map(|path| watch(path, on_change)).transpose()?;
    *state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = watcher;
    Ok(())
}

/// Watches `path` (replacing any previous watch), or stops watching when it is `None`.
#[tauri::command]
pub async fn watch_file(
    app: AppHandle,
    state: State<'_, WatcherState>,
    path: Option<String>,
) -> AppResult<()> {
    let reported = path.clone().unwrap_or_default();
    let emit = move || {
        let payload = FileChanged {
            path: reported.clone(),
        };
        let _ = app.emit(FILE_CHANGED_EVENT, payload);
    };
    replace_watcher(&state, path.as_deref().map(Path::new), emit)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::sync::mpsc;

    use super::*;

    fn paths(items: &[&str]) -> Vec<PathBuf> {
        items.iter().map(PathBuf::from).collect()
    }

    #[test]
    fn concerns_the_target_among_other_paths() {
        let target = Path::new("/notes/a.md");
        assert!(concerns(&paths(&["/notes/b.md", "/notes/a.md"]), target));
    }

    #[test]
    fn ignores_siblings_and_empty_batches() {
        let target = Path::new("/notes/a.md");
        assert!(!concerns(
            &paths(&["/notes/b.md", "/notes/a.md.swp"]),
            target
        ));
        assert!(!concerns(&[], target));
    }

    #[test]
    fn event_target_joins_the_canonical_parent_and_the_file_name() {
        let dir = tempfile::tempdir().unwrap();
        let (target, parent) = event_target(&dir.path().join("gone.md")).unwrap();
        assert_eq!(parent, dir.path().canonicalize().unwrap());
        assert_eq!(target, parent.join("gone.md"));
    }

    #[test]
    fn missing_parent_is_not_found() {
        let dir = tempfile::tempdir().unwrap();
        let error = event_target(&dir.path().join("missing/a.md")).unwrap_err();
        assert_eq!(error.kind, ErrorKind::NotFound);
    }

    #[test]
    fn path_without_file_name_is_invalid() {
        let error = event_target(Path::new("/")).unwrap_err();
        assert_eq!(error.kind, ErrorKind::InvalidInput);
    }

    #[test]
    fn reports_a_write_to_the_watched_file() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.md");
        fs::write(&file, "one").unwrap();
        let (sender, receiver) = mpsc::channel();
        let _watcher = watch(&file, move || {
            let _ = sender.send(());
        })
        .unwrap();

        fs::write(&file, "two").unwrap();

        receiver
            .recv_timeout(Duration::from_secs(5))
            .expect("no change reported within 5 s");
    }

    #[test]
    fn stopping_drops_the_watcher() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.md");
        let state = WatcherState::default();
        replace_watcher(&state, Some(&file), || {}).unwrap();
        assert!(state.0.lock().unwrap().is_some());
        replace_watcher(&state, None, || {}).unwrap();
        assert!(state.0.lock().unwrap().is_none());
    }
}
