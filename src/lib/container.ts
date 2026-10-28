// Composition root: the one place that picks concrete adapters and wires the use cases to them.
// Presentation receives the returned container instead of importing infrastructure.
import { createDocuments, type Documents } from './application/documents';
import { createPreferences, type PreferencesUseCases } from './application/preferences';
import { createWorkspace, type WorkspaceUseCases } from './application/workspace';
import { createMemoryServices } from './infrastructure/memory';
import { BrowserDialogs, BrowserOpener, DEMO_FOLDER, seedDemo } from './infrastructure/memory/demo';
import {
  TauriDialogs,
  TauriOpenRequests,
  tauriFileSystem,
  tauriOpener,
  tauriPreferencesStore,
  tauriRenderer,
  tauriWatcher,
  tauriWindow,
} from './infrastructure/tauri';
import { isTauri } from './isTauri';
import type {
  AppWindow,
  Dialogs,
  FileSystem,
  ExternalOpener,
  FileWatcher,
  MarkdownRenderer,
  Notifier,
  OpenRequests,
  PreferencesStore,
  Translate,
} from './ports';

export type ContainerMode = 'tauri' | 'memory';

export interface ContainerOptions {
  /** Toasts live in the presentation layer, which hands its notifier in. */
  readonly notifier: Notifier;
  readonly t: Translate;
  /** Defaults to `'tauri'` inside the Tauri webview and `'memory'` anywhere else. */
  readonly mode?: ContainerMode;
}

export interface Container {
  readonly documents: Documents;
  readonly workspace: WorkspaceUseCases;
  readonly preferences: PreferencesUseCases;
  /** Ports the presentation subscribes to directly. */
  readonly watcher: FileWatcher;
  readonly renderer: MarkdownRenderer;
  readonly openRequests: OpenRequests;
  readonly opener: ExternalOpener;
}

interface Ports {
  readonly fs: FileSystem;
  readonly watcher: FileWatcher;
  readonly renderer: MarkdownRenderer;
  readonly dialogs: Dialogs;
  readonly window: AppWindow;
  readonly store: PreferencesStore;
  readonly openRequests: OpenRequests;
  readonly opener: ExternalOpener;
}

const tauriPorts = (t: Translate): Ports => ({
  fs: tauriFileSystem,
  watcher: tauriWatcher,
  renderer: tauriRenderer,
  dialogs: new TauriDialogs(t),
  window: tauriWindow,
  store: tauriPreferencesStore,
  openRequests: new TauriOpenRequests(),
  opener: tauriOpener,
});

/** markdown-it only ships in the browser build (Tauri renders with comrak), so it loads on first use. */
const lazyDemoRenderer: MarkdownRenderer = {
  render: async (markdown) => {
    const { DemoRenderer } = await import('./infrastructure/memory/demoRenderer');
    return new DemoRenderer().render(markdown);
  },
};

/** In a plain browser: an in-memory demo workspace, opened on first run. */
const memoryPorts = (): Ports => {
  const services = createMemoryServices();
  seedDemo(services.fs);
  services.preferences.raw ??= { lastFolder: DEMO_FOLDER, lastFile: `${DEMO_FOLDER}/Welcome.md` };
  return {
    ...services,
    renderer: lazyDemoRenderer,
    opener: new BrowserOpener(),
    dialogs: new BrowserDialogs(),
    store: services.preferences,
  };
};

/** macOS and Windows file systems ignore case; Linux ones do not. */
const hostIgnoresCase = (): boolean =>
  typeof navigator !== 'undefined' && !/linux/i.test(navigator.userAgent);

export const createContainer = ({
  notifier,
  t,
  mode = isTauri() ? 'tauri' : 'memory',
}: ContainerOptions): Container => {
  const ports = mode === 'tauri' ? tauriPorts(t) : memoryPorts();
  const { fs, dialogs, window, watcher, renderer, store, openRequests, opener } = ports;
  return {
    documents: createDocuments({ fs, dialogs, window, watcher, notifier, t }),
    workspace: createWorkspace({
      fs,
      dialogs,
      notifier,
      t,
      caseInsensitive: mode === 'tauri' && hostIgnoresCase(),
    }),
    preferences: createPreferences({ store, notifier, t }),
    watcher,
    renderer,
    openRequests,
    opener,
  };
};
