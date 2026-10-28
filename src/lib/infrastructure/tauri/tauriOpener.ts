import { openUrl } from '@tauri-apps/plugin-opener';
import type { ExternalOpener } from '../../ports';
import { attempt } from './invoke';

/** External addresses through plugin-opener, which hands them to the system. */
export const tauriOpener: ExternalOpener = {
  openExternal: (url) => attempt(() => openUrl(url)),
};
