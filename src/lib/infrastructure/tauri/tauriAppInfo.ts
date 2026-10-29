import { getVersion } from '@tauri-apps/api/app';
import type { AppInfo } from '../../ports';
import { attempt } from './invoke';

/** The version declared in tauri.conf.json, read from the running app. */
export const tauriAppInfo: AppInfo = {
  version: () => attempt(getVersion),
};
