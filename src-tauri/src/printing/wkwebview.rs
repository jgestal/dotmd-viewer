//! macOS: an NSPrintOperation of the WKWebView that saves straight to a file, without panels.

use std::path::Path;

use objc2::runtime::AnyObject;
use objc2_app_kit::{
    NSPrintInfo, NSPrintJobSavingURL, NSPrintSaveJob, NSPrintingPaginationMode, NSWindow,
};
use objc2_foundation::{NSPoint, NSRect, NSSize, NSString, NSURL};
use objc2_web_kit::WKWebView;
use tauri::webview::PlatformWebview;

use super::{Outcome, Page};
use std::sync::mpsc::Sender;

/// Starts the print operation; the file appears when WebKit has finished, which `wait_for_pdf`
/// notices, so nothing is reported here.
pub fn print_to_pdf(
    webview: &PlatformWebview,
    target: &Path,
    page: Page,
    _report: Sender<Outcome>,
) {
    // SAFETY: Tauri hands out the live WKWebView and NSWindow, and this runs on the main thread.
    unsafe {
        let web_view = &*(webview.inner() as *const WKWebView);
        let window = &*(webview.ns_window() as *const NSWindow);
        let info = NSPrintInfo::new();
        info.setJobDisposition(NSPrintSaveJob);
        let url = NSURL::fileURLWithPath(&NSString::from_str(&target.to_string_lossy()));
        let key: &AnyObject = &*(NSPrintJobSavingURL as *const NSString as *const AnyObject);
        let _: () = objc2::msg_send![&*info.dictionary(), setObject: &*url, forKey: key];
        info.setPaperSize(NSSize::new(page.width, page.height));
        info.setTopMargin(page.margin);
        info.setBottomMargin(page.margin);
        info.setLeftMargin(page.margin);
        info.setRightMargin(page.margin);
        info.setHorizontalPagination(NSPrintingPaginationMode::Fit);
        info.setVerticalPagination(NSPrintingPaginationMode::Automatic);
        info.setHorizontallyCentered(false);
        info.setVerticallyCentered(false);
        let operation = web_view.printOperationWithPrintInfo(&info);
        operation.setShowsPrintPanel(false);
        operation.setShowsProgressPanel(false);
        // WKWebView prints blank pages unless its print view has a real frame.
        if let Some(view) = operation.view() {
            let content = NSSize::new(
                page.width - 2.0 * page.margin,
                page.height - 2.0 * page.margin,
            );
            view.setFrame(NSRect::new(NSPoint::new(0.0, 0.0), content));
        }
        operation.runOperationModalForWindow_delegate_didRunSelector_contextInfo(
            window,
            None,
            None,
            std::ptr::null_mut(),
        );
    }
}
