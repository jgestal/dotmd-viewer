//! Printing and PDF export of what the webview currently shows. The frontend first turns the
//! window into the printable document (print.css shows only that on paper), then asks here to
//! print it: through the system print dialog, or straight into a PDF file with the platform's own
//! web engine (WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux).

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, Sender};
use std::time::{Duration, Instant};

use tauri::WebviewWindow;

use crate::error::{AppError, AppResult, ErrorKind};

#[cfg(target_os = "linux")]
mod webkitgtk;
#[cfg(target_os = "windows")]
mod webview2;
#[cfg(target_os = "macos")]
mod wkwebview;

#[cfg(target_os = "linux")]
use webkitgtk as platform;
#[cfg(target_os = "windows")]
use webview2 as platform;
#[cfg(target_os = "macos")]
use wkwebview as platform;

/// How long a PDF may take to be written before the export is given up.
const EXPORT_TIMEOUT: Duration = Duration::from_secs(60);
const POLL_INTERVAL: Duration = Duration::from_millis(250);
const POINTS_PER_MM: f64 = 72.0 / 25.4;
const MAX_MARGIN_MM: f64 = 50.0;

/// Paper and margin in PostScript points (1/72 in).
#[derive(Debug, Clone, Copy, PartialEq)]
struct Page {
    width: f64,
    height: f64,
    margin: f64,
}

/// What a platform reports when it knows the outcome itself; the others are told by the file.
type Outcome = Result<(), String>;

fn page_for(size: &str, margin_mm: f64) -> AppResult<Page> {
    let (width, height) = match size {
        "a4" => (595.28, 841.89),
        "letter" => (612.0, 792.0),
        other => {
            return Err(AppError::invalid_input(format!(
                "unknown page size {other}"
            )));
        }
    };
    if !(0.0..=MAX_MARGIN_MM).contains(&margin_mm) {
        return Err(AppError::invalid_input(format!(
            "margin must be between 0 and {MAX_MARGIN_MM} mm"
        )));
    }
    Ok(Page {
        width,
        height,
        margin: margin_mm * POINTS_PER_MM,
    })
}

/// Waits until the PDF is written: the platform said so, or the file stopped growing.
fn wait_for_pdf(path: &Path, outcome: &Receiver<Outcome>, timeout: Duration) -> AppResult<()> {
    let started = Instant::now();
    let mut last_size = 0;
    loop {
        std::thread::sleep(POLL_INTERVAL);
        match outcome.try_recv() {
            Ok(Ok(())) => return Ok(()),
            Ok(Err(message)) => return Err(AppError::new(ErrorKind::Io, message)),
            Err(_) => {}
        }
        let size = fs::metadata(path).map(|meta| meta.len()).unwrap_or(0);
        if size > 0 && size == last_size {
            return Ok(());
        }
        last_size = size;
        if started.elapsed() > timeout {
            return Err(
                AppError::new(ErrorKind::Io, "the PDF was not written in time").with_path(path),
            );
        }
    }
}

fn webview_error(error: tauri::Error) -> AppError {
    AppError::new(ErrorKind::Io, error.to_string())
}

/// Opens the system print dialog for the webview.
#[tauri::command]
pub async fn print_page(window: WebviewWindow) -> AppResult<()> {
    window.print().map_err(webview_error)
}

/// Writes the webview, printed on `page_size` paper (`a4` or `letter`) with the given margin, to
/// the PDF file at `path`, replacing it.
#[tauri::command]
pub async fn export_pdf(
    window: WebviewWindow,
    path: String,
    page_size: String,
    margin_mm: f64,
) -> AppResult<()> {
    let page = page_for(&page_size, margin_mm)?;
    let target = PathBuf::from(path);
    if target.exists() {
        fs::remove_file(&target).map_err(|error| AppError::io(error, &target))?;
    }
    let (report, outcome): (Sender<Outcome>, Receiver<Outcome>) = mpsc::channel();
    let job = target.clone();
    window
        .with_webview(move |webview| platform::print_to_pdf(&webview, &job, page, report))
        .map_err(webview_error)?;
    tauri::async_runtime::spawn_blocking(move || wait_for_pdf(&target, &outcome, EXPORT_TIMEOUT))
        .await
        .map_err(|error| AppError::new(ErrorKind::Io, error.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    const SHORT: Duration = Duration::from_millis(600);

    #[test]
    fn a4_page_in_points_with_margin_converted_from_millimetres() {
        let page = page_for("a4", 20.0).unwrap();
        assert_eq!((page.width, page.height), (595.28, 841.89));
        assert!((page.margin - 56.69).abs() < 0.01);
    }

    #[test]
    fn letter_page_without_margin() {
        let page = page_for("letter", 0.0).unwrap();
        assert_eq!(
            page,
            Page {
                width: 612.0,
                height: 792.0,
                margin: 0.0
            }
        );
    }

    #[test]
    fn rejects_unknown_paper_and_absurd_margins() {
        for (size, margin) in [("a3", 0.0), ("a4", -1.0), ("a4", 51.0), ("a4", f64::NAN)] {
            let error = page_for(size, margin).unwrap_err();
            assert_eq!(error.kind, ErrorKind::InvalidInput, "{size} {margin}");
        }
    }

    #[test]
    fn waiting_ends_when_the_file_stops_growing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.pdf");
        fs::write(&path, b"%PDF-1.4").unwrap();
        let (_keep_open, outcome) = mpsc::channel();
        assert!(wait_for_pdf(&path, &outcome, SHORT * 10).is_ok());
    }

    #[test]
    fn waiting_ends_when_the_platform_reports_success() {
        let dir = tempfile::tempdir().unwrap();
        let (report, outcome) = mpsc::channel();
        report.send(Ok(())).unwrap();
        assert!(wait_for_pdf(&dir.path().join("a.pdf"), &outcome, SHORT).is_ok());
    }

    #[test]
    fn waiting_fails_with_the_platforms_message() {
        let dir = tempfile::tempdir().unwrap();
        let (report, outcome) = mpsc::channel();
        report.send(Err("printing failed".into())).unwrap();
        let error = wait_for_pdf(&dir.path().join("a.pdf"), &outcome, SHORT).unwrap_err();
        assert_eq!(error.message, "printing failed");
    }

    #[test]
    fn waiting_times_out_when_nothing_is_written() {
        let dir = tempfile::tempdir().unwrap();
        let (_keep_open, outcome) = mpsc::channel();
        let error = wait_for_pdf(&dir.path().join("a.pdf"), &outcome, Duration::ZERO).unwrap_err();
        assert_eq!(error.kind, ErrorKind::Io);
        assert!(error.path.is_some());
    }
}
