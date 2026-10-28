import { getCurrentWindow } from '@tauri-apps/api/window';
import type { AppWindow } from '../../ports';
import { attempt, call } from './invoke';

/** Window title through the JS API; proxy icon and edited dot through `set_document_state`. */
export const tauriWindow: AppWindow = {
  async showDocument(title, path, edited) {
    await attempt(() => getCurrentWindow().setTitle(title));
    await call<void>('set_document_state', { path, edited });
  },
};
