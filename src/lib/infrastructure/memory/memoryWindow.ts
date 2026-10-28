import type { AppWindow } from '../../ports';

export interface WindowState {
  readonly title: string;
  readonly path: string | null;
  readonly edited: boolean;
}

/** Remembers what the app asked the window to show. */
export class MemoryWindow implements AppWindow {
  /** Every `showDocument` call, in order. */
  readonly calls: WindowState[] = [];
  fullscreen = false;

  /** Every `reveal` call so far; there is no real window to show. */
  reveals = 0;

  /** What the window shows now, or `null` before the first call. */
  get current(): WindowState | null {
    return this.calls.at(-1) ?? null;
  }

  async showDocument(title: string, path: string | null, edited: boolean): Promise<void> {
    this.calls.push({ title, path, edited });
  }

  async toggleFullscreen(): Promise<void> {
    this.fullscreen = !this.fullscreen;
  }

  async reveal(): Promise<void> {
    this.reveals += 1;
  }
}
