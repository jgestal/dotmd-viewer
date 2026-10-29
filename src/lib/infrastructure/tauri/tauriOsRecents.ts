import type { OsRecents } from '../../ports';
import { call } from './invoke';

/** The system's recent documents (Dock, Jump List, recently-used list) through `os_recents.rs`. */
export const tauriOsRecents: OsRecents = {
  async add(path) {
    await call('add_os_recent', { path });
  },
  async clear() {
    await call('clear_os_recents');
  },
};
