import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppWindow } from '../../ports';
import { attempt, call } from './invoke';
import { formatWindowTitle, runsOnMac } from './windowTitle';

/** Window title through the JS API; proxy icon and edited dot through `set_document_state`. */
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
};
