import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppWindow } from '../../ports';
import { attempt, call } from './invoke';
import { subscribe } from './subscription';
import { formatWindowTitle, runsOnMac } from './windowTitle';

/**
 * Window title through the JS API; proxy icon and edited dot through `set_document_state`.
 * The window starts hidden (tauri.conf.json), so `reveal` is the first thing the user sees.
 */
export const tauriWindow: AppWindow = {
  async showDocument(name, path, edited) {
    const title = formatWindowTitle(name, edited, runsOnMac(), path !== null || edited);
    await attempt(() => getCurrentWindow().setTitle(title));
    await call<void>('set_document_state', { path, edited });
  },

  async toggleFullscreen() {
    const window = getCurrentWindow();
    await attempt(async () => window.setFullscreen(!(await window.isFullscreen())));
  },

  reveal: () => attempt(() => getCurrentWindow().show()),

  onCloseRequested(handler) {
    // The close is always held back: when the user agrees, `quit_app` exits (and tells Rust not to
    // ask again), instead of the window closing and the system's exit request asking a second time.
    const unlisten = attempt(() =>
      getCurrentWindow().onCloseRequested(async (event) => {
        event.preventDefault();
        if (await handler()) await call<void>('quit_app');
      }),
    );
    return () => void unlisten.then((stop) => stop()).catch(() => undefined);
  },

  onQuitRequested: (handler) => subscribe<void>('quit-requested', handler).unsubscribe,

  quit: () => call<void>('quit_app'),
};
