import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { DropEvent, DropTarget } from '../../ports';
import { attempt } from './invoke';

/** Tauri reports the pointer in physical pixels; the page lays out in CSS pixels. */
const cssPixels = ({ x, y }: { x: number; y: number }) => ({
  x: x / window.devicePixelRatio,
  y: y / window.devicePixelRatio,
});

/**
 * Files dragged from the OS onto the window, through the webview's native drag and drop (on by
 * default: `dragDropEnabled` in tauri.conf.json). Tauri names the paths only on `enter` and
 * `drop`, so the ones from `enter` are repeated on every `over`.
 */
export class TauriDropTarget implements DropTarget {
  onDrag(listener: (event: DropEvent) => void): () => void {
    let dragged: readonly string[] = [];
    const unlisten = attempt(() =>
      getCurrentWebview().onDragDropEvent(({ payload }) => {
        if (payload.type === 'enter' || payload.type === 'drop') dragged = payload.paths;
        if (payload.type === 'leave') listener({ type: 'leave', paths: [] });
        else
          listener({ type: payload.type, paths: dragged, position: cssPixels(payload.position) });
      }),
    );
    return () => void unlisten.then((stop) => stop()).catch(() => undefined);
  }
}
