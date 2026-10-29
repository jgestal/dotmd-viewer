//! Linux: a WebKitGTK print operation whose "Print to File" printer writes the PDF.

use std::path::Path;
use std::sync::mpsc::Sender;

use gtk::{PageSetup, PaperSize, PrintSettings, Unit};
use tauri::webview::PlatformWebview;
use webkit2gtk::{PrintOperation, PrintOperationExt};

use super::{Outcome, Page};

/// Starts the print operation; the file appears when WebKit has finished, which `wait_for_pdf`
/// notices, so only a failure to even start is reported.
pub fn print_to_pdf(webview: &PlatformWebview, target: &Path, page: Page, report: Sender<Outcome>) {
    let uri = match gtk::glib::filename_to_uri(target, None) {
        Ok(uri) => uri,
        Err(error) => {
            let _ = report.send(Err(error.to_string()));
            return;
        }
    };
    let settings = PrintSettings::new();
    settings.set_printer("Print to File");
    settings.set("output-file-format", Some("pdf"));
    settings.set("output-uri", Some(uri.as_str()));
    let setup = PageSetup::new();
    let paper = PaperSize::new_custom("dotmd", "DotMD", page.width, page.height, Unit::Points);
    setup.set_paper_size(&paper);
    setup.set_top_margin(page.margin, Unit::Points);
    setup.set_bottom_margin(page.margin, Unit::Points);
    setup.set_left_margin(page.margin, Unit::Points);
    setup.set_right_margin(page.margin, Unit::Points);
    let operation = PrintOperation::new(&webview.inner());
    operation.set_print_settings(&settings);
    operation.set_page_setup(&setup);
    operation.print();
}
