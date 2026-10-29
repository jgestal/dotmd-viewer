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

  /** Whether `quit` was called: the app has exited. */
  quitCalled = false;

  private closeHandlers: (() => Promise<boolean>)[] = [];
  private quitHandlers: (() => void)[] = [];

  async reveal(): Promise<void> {
    this.reveals += 1;
  }

  onCloseRequested(handler: () => Promise<boolean>): () => void {
    this.closeHandlers.push(handler);
    return () => {
      this.closeHandlers = this.closeHandlers.filter((registered) => registered !== handler);
    };
  }

  onQuitRequested(handler: () => void): () => void {
    this.quitHandlers.push(handler);
    return () => {
      this.quitHandlers = this.quitHandlers.filter((registered) => registered !== handler);
    };
  }

  async quit(): Promise<void> {
    this.quitCalled = true;
  }

  /** The scheme the window chrome was last matched to. */
  theme: 'light' | 'dark' | null = null;

  async setTheme(shown: 'light' | 'dark'): Promise<void> {
    this.theme = shown;
  }

  /** The simulated system's scheme; `changeSystemScheme` switches it. */
  system: 'light' | 'dark' = 'light';
  private schemeHandlers: ((scheme: 'light' | 'dark') => void)[] = [];

  async systemScheme(): Promise<'light' | 'dark'> {
    return this.system;
  }

  onSystemSchemeChange(handler: (scheme: 'light' | 'dark') => void): () => void {
    this.schemeHandlers.push(handler);
    return () => {
      this.schemeHandlers = this.schemeHandlers.filter((registered) => registered !== handler);
    };
  }

  changeSystemScheme(scheme: 'light' | 'dark'): void {
    this.system = scheme;
    for (const handler of this.schemeHandlers) handler(scheme);
  }

  /** Simulates the user closing the window; true when it closed (and the app quit). */
  async requestClose(): Promise<boolean> {
    const answers = await Promise.all(this.closeHandlers.map((handler) => handler()));
    const allowed = answers.every(Boolean);
    if (allowed) this.quitCalled = true;
    return allowed;
  }

  /** Simulates the system asking to quit (Dock, Cmd+Q). */
  requestQuit(): void {
    for (const handler of this.quitHandlers) handler();
  }
}
