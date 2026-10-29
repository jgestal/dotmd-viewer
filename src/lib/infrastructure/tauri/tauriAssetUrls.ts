import { convertFileSrc } from '@tauri-apps/api/core';
import type { AssetUrls } from '../../ports';

/** Local files are served to the webview by Tauri's asset protocol (enabled in tauri.conf.json). */
export const tauriAssetUrls: AssetUrls = {
  toUrl: (path) => convertFileSrc(path),
};
