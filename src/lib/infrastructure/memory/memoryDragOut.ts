import type { DragOut } from '../../ports';

/** Remembers the drags the app handed to the system; nothing actually leaves the window. */
export class MemoryDragOut implements DragOut {
  /** Every drag, in order. */
  readonly started: { readonly paths: readonly string[]; readonly iconPath?: string }[] = [];

  async start(paths: readonly string[], iconPath?: string): Promise<void> {
    this.started.push({ paths, iconPath });
  }
}
