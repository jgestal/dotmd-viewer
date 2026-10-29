//! What the operating system asks us to do with files: launch arguments (`simpledotmd notes.md`,
//! `simpledotmd --export-pdf notes.md`), a second launch handing its arguments to the running
//! window, macOS Finder "Open With" / double-click events and Finder services. Until the frontend
//! says it is listening (by taking the pending list), requests are queued; afterwards they are
//! emitted as the `open-requests` event, so nothing is lost at start-up and nothing is handled
//! twice.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

pub const OPEN_REQUESTS_EVENT: &str = "open-requests";

const EXPORT_PDF_FLAG: &str = "--export-pdf";
const OUT_FLAG: &str = "--out";
const PRINT_FLAG: &str = "--print";
const NEW_FLAG: &str = "--new";

/// One thing to do, as the frontend receives it: `{ "action": "exportPdf", "path": "…" }`.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum OpenRequest {
    /// Open a file or folder.
    Open { path: String },
    /// Open the file and write it as a PDF to `out`, or next to it when `out` is absent.
    ExportPdf {
        path: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        out: Option<String>,
    },
    /// Open the file and show the print dialog.
    Print { path: String },
    /// Start an empty document.
    New,
}

#[derive(Default)]
pub struct OpenRequests(Mutex<Queue>);

#[derive(Default)]
struct Queue {
    listening: bool,
    pending: Vec<OpenRequest>,
}

impl OpenRequests {
    pub fn with_pending(requests: Vec<OpenRequest>) -> Self {
        Self(Mutex::new(Queue {
            listening: false,
            pending: requests,
        }))
    }

    /// Queues the requests, or returns them to be emitted when the frontend is already listening.
    fn offer(&self, requests: Vec<OpenRequest>) -> Option<Vec<OpenRequest>> {
        let mut queue = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if queue.listening {
            Some(requests)
        } else {
            queue.pending.extend(requests);
            None
        }
    }

    /// Hands over everything queued so far; later requests are emitted as events.
    fn take(&self) -> Vec<OpenRequest> {
        let mut queue = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        queue.listening = true;
        std::mem::take(&mut queue.pending)
    }
}

/// The requests a command line makes. Bare arguments are files to open; `--export-pdf <file>
/// [--out <pdf>]`, `--print <file>` and `--new` ask for those actions; any other option (such as
/// macOS's `-psn_…`) and a flag missing its file are skipped. Relative paths are resolved against
/// `cwd`; whether they exist is the frontend's business, so it can say which one is missing.
pub fn requests_from_args<I, S>(args: I, cwd: &Path) -> Vec<OpenRequest>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut args = args
        .into_iter()
        .map(|arg| arg.as_ref().to_owned())
        .filter(|arg| !arg.is_empty())
        .peekable();
    let mut requests = Vec::new();
    while let Some(arg) = args.next() {
        let request = match arg.as_str() {
            EXPORT_PDF_FLAG => args.next().map(|file| OpenRequest::ExportPdf {
                path: absolute(&file, cwd),
                out: args
                    .next_if(|next| next == OUT_FLAG)
                    .and_then(|_| args.next())
                    .map(|out| absolute(&out, cwd)),
            }),
            PRINT_FLAG => args.next().map(|file| OpenRequest::Print {
                path: absolute(&file, cwd),
            }),
            NEW_FLAG => Some(OpenRequest::New),
            option if option.starts_with('-') => None,
            file => Some(OpenRequest::Open {
                path: absolute(file, cwd),
            }),
        };
        requests.extend(request);
    }
    requests
}

/// Plain "open these files" requests, as Finder delivers them.
pub fn open_all(paths: impl IntoIterator<Item = String>) -> Vec<OpenRequest> {
    paths
        .into_iter()
        .map(|path| OpenRequest::Open { path })
        .collect()
}

fn absolute(arg: &str, cwd: &Path) -> String {
    let path = PathBuf::from(arg);
    let absolute = if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    };
    absolute.to_string_lossy().into_owned()
}

/// Delivers requests now or later, depending on whether the frontend is listening.
pub fn deliver(app: &AppHandle, requests: Vec<OpenRequest>) {
    if requests.is_empty() {
        return;
    }
    if let Some(requests) = app.state::<OpenRequests>().offer(requests) {
        let _ = app.emit(OPEN_REQUESTS_EVENT, requests);
    }
}

/// A second launch: handle its requests here and bring the window forward.
pub fn on_second_instance(app: &AppHandle, argv: Vec<String>, cwd: String) {
    deliver(
        app,
        requests_from_args(argv.into_iter().skip(1), Path::new(&cwd)),
    );
    bring_forward(app);
}

/// Shows the window in front, so a request made from outside is seen (and a print dialog too).
pub fn bring_forward(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[tauri::command]
pub fn take_pending_open(state: tauri::State<OpenRequests>) -> Vec<OpenRequest> {
    state.take()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open(path: &str) -> OpenRequest {
        OpenRequest::Open { path: path.into() }
    }

    fn export(path: &str, out: Option<&str>) -> OpenRequest {
        OpenRequest::ExportPdf {
            path: path.into(),
            out: out.map(Into::into),
        }
    }

    #[test]
    #[cfg(unix)]
    fn resolves_relative_paths_and_skips_unknown_options() {
        let cwd = Path::new("/home/ana/notes");
        let requests = requests_from_args(["-psn_0_123", "a.md", "/tmp/b.md", "", "sub/c.md"], cwd);
        assert_eq!(
            requests,
            vec![
                open("/home/ana/notes/a.md"),
                open("/tmp/b.md"),
                open("/home/ana/notes/sub/c.md"),
            ]
        );
    }

    #[test]
    #[cfg(unix)]
    fn reads_export_print_and_new_actions_in_order() {
        let requests = requests_from_args(
            ["--export-pdf", "a.md", "--print", "/b.md", "--new", "c.md"],
            Path::new("/w"),
        );
        assert_eq!(
            requests,
            vec![
                export("/w/a.md", None),
                OpenRequest::Print {
                    path: "/b.md".into()
                },
                OpenRequest::New,
                open("/w/c.md"),
            ]
        );
    }

    #[test]
    #[cfg(unix)]
    fn takes_the_pdf_destination_that_follows_the_export() {
        let requests = requests_from_args(
            ["--export-pdf", "a.md", "--out", "out/a.pdf", "b.md"],
            Path::new("/w"),
        );
        assert_eq!(
            requests,
            vec![export("/w/a.md", Some("/w/out/a.pdf")), open("/w/b.md")]
        );
    }

    #[test]
    #[cfg(unix)]
    fn takes_the_next_argument_as_the_file_even_when_it_looks_like_an_option() {
        let requests = requests_from_args(["--print", "-notes.md"], Path::new("/w"));
        assert_eq!(
            requests,
            vec![OpenRequest::Print {
                path: "/w/-notes.md".into()
            }]
        );
    }

    #[test]
    fn skips_an_action_missing_its_file() {
        let cwd = Path::new("/w");
        assert_eq!(requests_from_args(["--export-pdf"], cwd), vec![]);
        assert_eq!(requests_from_args(["--print", ""], cwd), vec![]);
    }

    #[test]
    #[cfg(unix)]
    fn skips_an_out_flag_missing_its_file_or_without_an_export() {
        let cwd = Path::new("/w");
        assert_eq!(
            requests_from_args(["--export-pdf", "a.md", "--out"], cwd),
            vec![export("/w/a.md", None)]
        );
        assert_eq!(
            requests_from_args(["--out", "a.pdf"], cwd),
            vec![open("/w/a.pdf")]
        );
    }

    #[test]
    #[cfg(windows)]
    fn keeps_windows_paths_from_the_explorer_verbs() {
        let requests = requests_from_args(
            ["--export-pdf", r"C:\Users\ana\notes.md"],
            Path::new(r"C:\Windows"),
        );
        assert_eq!(requests, vec![export(r"C:\Users\ana\notes.md", None)]);
    }

    #[test]
    fn serialises_with_the_action_as_a_tag() {
        let requests = vec![
            open("/a.md"),
            export("/b.md", None),
            export("/b.md", Some("/b.pdf")),
            OpenRequest::Print {
                path: "/c.md".into(),
            },
            OpenRequest::New,
        ];
        assert_eq!(
            serde_json::to_string(&requests).unwrap(),
            concat!(
                r#"[{"action":"open","path":"/a.md"},"#,
                r#"{"action":"exportPdf","path":"/b.md"},"#,
                r#"{"action":"exportPdf","path":"/b.md","out":"/b.pdf"},"#,
                r#"{"action":"print","path":"/c.md"},"#,
                r#"{"action":"new"}]"#
            )
        );
    }

    #[test]
    fn wraps_paths_as_open_requests() {
        assert_eq!(
            open_all(["/a.md".to_owned(), "/b".to_owned()]),
            vec![open("/a.md"), open("/b")]
        );
    }

    #[test]
    fn queues_until_the_frontend_takes_the_list() {
        let requests = OpenRequests::with_pending(vec![open("/a.md")]);
        assert_eq!(requests.offer(vec![open("/b.md")]), None);
        assert_eq!(requests.take(), vec![open("/a.md"), open("/b.md")]);
    }

    #[test]
    fn hands_later_requests_back_for_emitting() {
        let requests = OpenRequests::default();
        assert!(requests.take().is_empty());
        assert_eq!(
            requests.offer(vec![open("/c.md")]),
            Some(vec![open("/c.md")])
        );
        assert!(requests.take().is_empty());
    }
}
