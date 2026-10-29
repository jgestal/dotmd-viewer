//! Windows: WebView2's `PrintToPdf`, which reports when the file is written.

use std::path::Path;
use std::sync::mpsc::Sender;

use tauri::webview::PlatformWebview;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2_7, ICoreWebView2Environment6, ICoreWebView2PrintSettings,
};
use webview2_com::PrintToPdfCompletedHandler;
use windows::core::{HSTRING, Interface};

use super::{Outcome, Page};

const POINTS_PER_INCH: f64 = 72.0;

/// WebView2 measures paper and margins in inches.
fn print_settings(
    webview: &PlatformWebview,
    page: Page,
) -> windows::core::Result<ICoreWebView2PrintSettings> {
    let inches = |points: f64| points / POINTS_PER_INCH;
    let settings = unsafe {
        webview
            .environment()
            .cast::<ICoreWebView2Environment6>()?
            .CreatePrintSettings()?
    };
    unsafe {
        settings.SetPageWidth(inches(page.width))?;
        settings.SetPageHeight(inches(page.height))?;
        settings.SetMarginTop(inches(page.margin))?;
        settings.SetMarginBottom(inches(page.margin))?;
        settings.SetMarginLeft(inches(page.margin))?;
        settings.SetMarginRight(inches(page.margin))?;
        settings.SetShouldPrintBackgrounds(true)?;
        settings.SetShouldPrintHeaderAndFooter(false)?;
    }
    Ok(settings)
}

fn start(
    webview: &PlatformWebview,
    target: &Path,
    page: Page,
    report: &Sender<Outcome>,
) -> windows::core::Result<()> {
    let settings = print_settings(webview, page)?;
    let core = unsafe {
        webview
            .controller()
            .CoreWebView2()?
            .cast::<ICoreWebView2_7>()?
    };
    let done = report.clone();
    let handler = PrintToPdfCompletedHandler::create(Box::new(move |error, succeeded| {
        let outcome = match error {
            Err(error) => Err(error.to_string()),
            Ok(()) if succeeded => Ok(()),
            Ok(()) => Err("WebView2 could not print the page".to_owned()),
        };
        let _ = done.send(outcome);
        Ok(())
    }));
    let path = HSTRING::from(target.as_os_str());
    unsafe { core.PrintToPdf(&path, &settings, &handler) }
}

/// Starts `PrintToPdf`; its completion handler tells `wait_for_pdf` how it went.
pub fn print_to_pdf(webview: &PlatformWebview, target: &Path, page: Page, report: Sender<Outcome>) {
    if let Err(error) = start(webview, target, page, &report) {
        let _ = report.send(Err(error.to_string()));
    }
}
