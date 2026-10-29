import type { AppInfo } from '../../ports';
import { version } from '../../../../package.json';

/** The version in package.json: browser mode has no app bundle to ask. */
export class MemoryAppInfo implements AppInfo {
  async version(): Promise<string> {
    return version;
  }
}
