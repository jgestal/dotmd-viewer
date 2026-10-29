//! Files the operating system asks us to open: launch arguments (`simpledotmd notes.md`), a
//! second launch handing its arguments to the running window, and macOS Finder "Open With" /
//! double-click events. Until the frontend says it is listening (by taking the pending list),
//! requests are queued; afterwards they are emitted as the `open-paths` event, so nothing is
//! lost at start-up and nothing is opened twice.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};

pub const OPEN_PATHS_EVENT: &str = "open-paths";

#[derive(Default)]
pub struct OpenRequests(Mutex<Queue>);

#[derive(Default)]
struct Queue {
    listening: bool,
    pending: Vec<String>,
}

impl OpenRequests {
    pub fn with_pending(paths: Vec<String>) -> Self {
        Self(Mutex::new(Queue {
            listening: false,
            pending: paths,
        }))
    }

    /// Queues the paths, or returns them to be emitted when the frontend is already listening.
    fn offer(&self, paths: Vec<String>) -> Option<Vec<String>> {
        let mut queue = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if queue.listening {
            Some(paths)
        } else {
            queue.pending.extend(paths);
            None
        }
    }

    /// Hands over everything queued so far; later requests are emitted as events.
    fn take(&self) -> Vec<String> {
        let mut queue = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        queue.listening = true;
        std::mem::take(&mut queue.pending)
    }
}

/// Paths named on a command line: options are skipped and relative paths resolved against
/// `cwd`. Whether they exist is the frontend's business, so it can say which one is missing.
pub fn paths_from_args<I, S>(args: I, cwd: &Path) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter()
        .map(|arg| arg.as_ref().to_owned())
        .filter(|arg| !arg.is_empty() && !arg.starts_with('-'))
        .map(|arg| {
            let path = PathBuf::from(&arg);
            let absolute = if path.is_absolute() {
                path
            } else {
                cwd.join(path)
            };
            absolute.to_string_lossy().into_owned()
        })
        .collect()
}

/// Delivers paths now or later, depending on whether the frontend is listening.
pub fn deliver(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    if let Some(paths) = app.state::<OpenRequests>().offer(paths) {
        let _ = app.emit(OPEN_PATHS_EVENT, paths);
    }
}

/// A second launch: open its files here and bring the window forward.
pub fn on_second_instance(app: &AppHandle, argv: Vec<String>, cwd: String) {
    deliver(
        app,
        paths_from_args(argv.into_iter().skip(1), Path::new(&cwd)),
    );
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn take_pending_open(state: tauri::State<OpenRequests>) -> Vec<String> {
    state.take()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(unix)]
    fn resolves_relative_paths_and_skips_options() {
        let cwd = Path::new("/home/ana/notes");
        let paths = paths_from_args(["-psn_0_123", "a.md", "/tmp/b.md", "", "sub/c.md"], cwd);
        assert_eq!(
            paths,
            vec![
                cwd.join("a.md").to_string_lossy().into_owned(),
                "/tmp/b.md".to_owned(),
                cwd.join("sub/c.md").to_string_lossy().into_owned(),
            ]
        );
    }

    #[test]
    fn queues_until_the_frontend_takes_the_list() {
        let requests = OpenRequests::with_pending(vec!["/a.md".into()]);
        assert_eq!(requests.offer(vec!["/b.md".into()]), None);
        assert_eq!(
            requests.take(),
            vec!["/a.md".to_owned(), "/b.md".to_owned()]
        );
    }

    #[test]
    fn hands_later_requests_back_for_emitting() {
        let requests = OpenRequests::default();
        assert!(requests.take().is_empty());
        assert_eq!(
            requests.offer(vec!["/c.md".into()]),
            Some(vec!["/c.md".to_owned()])
        );
        assert!(requests.take().is_empty());
    }
}
