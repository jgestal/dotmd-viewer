import type { FileWatcher } from '../../ports';
import { call } from './invoke';
import { subscribe } from './subscription';

interface FileChanged {
  readonly path: string;
}

/** FileWatcher over `watch_file` and the `file-changed` event. */
export const tauriWatcher: FileWatcher = {
  watch: (path) => call<void>('watch_file', { path }),
  onChange: (listener) =>
    subscribe<FileChanged>('file-changed', ({ path }) => listener(path)).unsubscribe,
};
