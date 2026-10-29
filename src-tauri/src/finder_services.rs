//! Finder services (right-click a Markdown file ▸ Services / Quick Actions): "Open in
//! SimpleDotMD", "Export to PDF with SimpleDotMD" and "Print with SimpleDotMD". Info.plist
//! declares them (`NSServices`); the provider object registered here answers them by turning the
//! selected files into open requests. Windows and Linux get their context menus from the
//! installed packages instead, so this module is macOS only.

use std::sync::OnceLock;

use objc2::rc::Retained;
use objc2::runtime::NSObject;
use objc2::{MainThreadMarker, MainThreadOnly, define_class, msg_send};
use objc2_app_kit::{
    NSApplication, NSPasteboard, NSPasteboardTypeFileURL, NSUpdateDynamicServices,
};
use objc2_foundation::NSString;
use tauri::{AppHandle, Url};

use crate::open_requests::{self, OpenRequest};

/// The app the services deliver to; set once when the provider is registered.
static APP: OnceLock<AppHandle> = OnceLock::new();

#[derive(Debug, Clone, Copy)]
enum ServiceAction {
    Open,
    ExportPdf,
    Print,
}

define_class!(
    // SAFETY: NSObject has no subclassing requirements and this class has no Drop impl.
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[name = "SimpleDotMDServiceProvider"]
    struct ServiceProvider;

    // Each method's name is the `NSMessage` of a service in Info.plist.
    impl ServiceProvider {
        #[unsafe(method(openFiles:userData:error:))]
        fn open_files(
            &self,
            pasteboard: &NSPasteboard,
            _user_data: *mut NSString,
            _error: *mut *mut NSString,
        ) {
            handle(pasteboard, ServiceAction::Open);
        }

        #[unsafe(method(exportPdf:userData:error:))]
        fn export_pdf(
            &self,
            pasteboard: &NSPasteboard,
            _user_data: *mut NSString,
            _error: *mut *mut NSString,
        ) {
            handle(pasteboard, ServiceAction::ExportPdf);
        }

        #[unsafe(method(printFiles:userData:error:))]
        fn print_files(
            &self,
            pasteboard: &NSPasteboard,
            _user_data: *mut NSString,
            _error: *mut *mut NSString,
        ) {
            handle(pasteboard, ServiceAction::Print);
        }
    }
);

/// Makes the app answer its Finder services. Called once, on the main thread, at start-up.
pub fn register(app: &AppHandle) {
    let Some(mtm) = MainThreadMarker::new() else {
        return;
    };
    if APP.set(app.clone()).is_err() {
        return;
    }
    // SAFETY: `init` is NSObject's designated initialiser and the class adds no state.
    let provider: Retained<ServiceProvider> =
        unsafe { msg_send![ServiceProvider::alloc(mtm), init] };
    // SAFETY: the provider implements the methods named by the app's NSServices entries.
    unsafe { NSApplication::sharedApplication(mtm).setServicesProvider(Some(&provider)) };
    // The application keeps the provider for as long as it runs.
    std::mem::forget(provider);
    // Refreshes the Services menu, so the entries appear right after an install or update.
    NSUpdateDynamicServices();
}

fn handle(pasteboard: &NSPasteboard, action: ServiceAction) {
    let Some(app) = APP.get() else {
        return;
    };
    open_requests::deliver(app, requests_for(action, &file_urls(pasteboard)));
    open_requests::bring_forward(app);
}

/// The `file://` URLs of the files selected in Finder.
fn file_urls(pasteboard: &NSPasteboard) -> Vec<String> {
    let Some(items) = pasteboard.pasteboardItems() else {
        return Vec::new();
    };
    // SAFETY: a constant AppKit string.
    let file_url = unsafe { NSPasteboardTypeFileURL };
    items
        .iter()
        .filter_map(|item| item.stringForType(file_url))
        .map(|url| url.to_string())
        .collect()
}

fn requests_for(action: ServiceAction, urls: &[String]) -> Vec<OpenRequest> {
    urls.iter()
        .filter_map(|url| Url::parse(url).ok()?.to_file_path().ok())
        .map(|path| path.to_string_lossy().into_owned())
        .map(|path| match action {
            ServiceAction::Open => OpenRequest::Open { path },
            ServiceAction::ExportPdf => OpenRequest::ExportPdf { path, out: None },
            ServiceAction::Print => OpenRequest::Print { path },
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn turns_finder_file_urls_into_requests_for_the_action() {
        let urls = [
            "file:///Users/ana/My%20Notes/caf%C3%A9.md".to_owned(),
            "https://example.com/a.md".to_owned(),
            "not a url".to_owned(),
        ];
        let path = "/Users/ana/My Notes/café.md".to_owned();
        assert_eq!(
            requests_for(ServiceAction::ExportPdf, &urls),
            vec![OpenRequest::ExportPdf {
                path: path.clone(),
                out: None
            }]
        );
        assert_eq!(
            requests_for(ServiceAction::Print, &urls),
            vec![OpenRequest::Print { path: path.clone() }]
        );
        assert_eq!(
            requests_for(ServiceAction::Open, &urls),
            vec![OpenRequest::Open { path }]
        );
    }
}
