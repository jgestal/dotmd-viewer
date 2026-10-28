//! Quitting with unsaved changes: every way out of the app (menu, Dock, Cmd+Q) first asks the
//! frontend, which shows the save/discard/cancel dialog. Once the user agreed, `quit_app` sets
//! the "confirmed" flag and exits without asking again.

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager, State};

pub const QUIT_REQUESTED_EVENT: &str = "quit-requested";

#[derive(Default)]
pub struct QuitState {
    confirmed: AtomicBool,
}

/// An exit the OS asked for (no explicit code) is held back until the user confirmed it.
fn should_hold_exit(code: Option<i32>, confirmed: bool) -> bool {
    code.is_none() && !confirmed
}

/// Called for `RunEvent::ExitRequested`: holds back an unconfirmed exit and asks the frontend.
/// Returns true when the exit was held back.
pub fn hold_exit(app: &AppHandle, code: Option<i32>) -> bool {
    let confirmed = app.state::<QuitState>().confirmed.load(Ordering::SeqCst);
    let hold = should_hold_exit(code, confirmed);
    if hold {
        let _ = app.emit(QUIT_REQUESTED_EVENT, ());
    }
    hold
}

/// Exits the app now: the frontend already asked the user about unsaved changes.
#[tauri::command]
pub fn quit_app(app: AppHandle, state: State<QuitState>) {
    state.confirmed.store(true, Ordering::SeqCst);
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::should_hold_exit;

    #[test]
    fn holds_back_an_exit_requested_by_the_system() {
        assert!(should_hold_exit(None, false));
    }

    #[test]
    fn lets_a_confirmed_exit_through() {
        assert!(!should_hold_exit(None, true));
    }

    #[test]
    fn lets_an_explicit_exit_code_through() {
        assert!(!should_hold_exit(Some(0), false));
    }
}
