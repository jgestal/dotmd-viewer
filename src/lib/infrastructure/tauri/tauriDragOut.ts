import { startDrag } from '@crabnebula/tauri-plugin-drag';
import type { DragOut } from '../../ports';
import { attempt, call } from './invoke';

/** Drag out of the window through tauri-plugin-drag; the cursor image comes from `drag_icon`. */
export const tauriDragOut: DragOut = {
  async start(paths, iconPath) {
    const icon = iconPath ?? (await call<string>('drag_icon'));
    await attempt(() => startDrag({ item: [...paths], icon }));
  },
};
