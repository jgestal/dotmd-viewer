// Composition root: the one place that picks concrete adapters and wires the use cases to them.
// Presentation receives the returned container instead of importing infrastructure.
import { createDrop, type DropUseCases } from './application/drop';
import { createImages, type ImageUseCases } from './application/images';
import { createDocuments, type Documents } from './application/documents';
import { createPreferences, type PreferencesUseCases } from './application/preferences';
import { createPrinting, type Printing } from './application/printing';
import { createWorkspace, type WorkspaceUseCases } from './application/workspace';
import {
  BrowserDropTarget,
  BrowserPdfExporter,
  BrowserPrinter,
  createMemoryServices,
  MemoryAppInfo,
  MemoryMenu,
} from './infrastructure/memory';
import { BrowserDialogs, BrowserOpener, DEMO_FOLDER, seedDemo } from './infrastructure/memory/demo';
import {
  TauriDialogs,
  TauriDropTarget,
  TauriOpenRequests,
  TauriMenu,
  tauriAssetUrls,
  tauriContextMenu,
  tauriDragOut,
  tauriFileSystem,
  tauriAppInfo,
  tauriOpener,
  tauriPdfExporter,
  tauriPreferencesStore,
  tauriPrinter,
  tauriRenderer,
  tauriWatcher,
  tauriWindow,
} from './infrastructure/tauri';
import { isTauri } from './isTauri';
import type {
  AppInfo,
  AppWindow,
  AssetUrls,
  ContextMenu,
  Dialogs,
  DragOut,
  DropTarget,
  FileSystem,
  ExternalOpener,
  FileWatcher,
  NativeMenu,
  MarkdownRenderer,
  Notifier,
  OpenRequests,
  PdfExporter,
  PreferencesStore,
  Printer,
  Translate,
} from './ports';

export type ContainerMode = 'tauri' | 'memory';

export interface ContainerOptions {
  /** Toasts live in the presentation layer, which hands its notifier in. */
  readonly notifier: Notifier;
  readonly t: Translate;
  /** Browser mode has no native menu: the presentation draws one and hands it in here. */
  readonly fallbackContextMenu: ContextMenu;
  /** Defaults to `'tauri'` inside the Tauri webview and `'memory'` anywhere else. */
  readonly mode?: ContainerMode;
}

export interface Container {
  readonly documents: Documents;
  readonly workspace: WorkspaceUseCases;
  readonly drop: DropUseCases;
  readonly images: ImageUseCases;
  readonly preferences: PreferencesUseCases;
  readonly printing: Printing;
  /** Ports the presentation subscribes to directly. */
  readonly watcher: FileWatcher;
  readonly renderer: MarkdownRenderer;
  readonly assetUrls: AssetUrls;
  readonly openRequests: OpenRequests;
  readonly opener: ExternalOpener;
  readonly window: AppWindow;
  readonly appInfo: AppInfo;
  readonly menu: NativeMenu;
  readonly dropTarget: DropTarget;
  readonly dragOut: DragOut;
  readonly contextMenu: ContextMenu;
}

interface Ports {
  readonly fs: FileSystem;
  readonly watcher: FileWatcher;
  readonly renderer: MarkdownRenderer;
  readonly assetUrls: AssetUrls;
  readonly dialogs: Dialogs;
  readonly window: AppWindow;
  readonly store: PreferencesStore;
  readonly openRequests: OpenRequests;
  readonly opener: ExternalOpener;
  readonly appInfo: AppInfo;
  readonly menu: NativeMenu;
  readonly dropTarget: DropTarget;
  readonly dragOut: DragOut;
  readonly contextMenu: ContextMenu;
  readonly printer: Printer;
  readonly pdfExporter: PdfExporter;
}

const tauriPorts = (t: Translate): Ports => ({
  fs: tauriFileSystem,
  watcher: tauriWatcher,
  renderer: tauriRenderer,
  assetUrls: tauriAssetUrls,
  dialogs: new TauriDialogs(t),
  window: tauriWindow,
  store: tauriPreferencesStore,
  openRequests: new TauriOpenRequests(),
  opener: tauriOpener,
  appInfo: tauriAppInfo,
  menu: new TauriMenu(),
  dropTarget: new TauriDropTarget(),
  dragOut: tauriDragOut,
  contextMenu: tauriContextMenu,
  printer: tauriPrinter,
  pdfExporter: tauriPdfExporter,
});

/** markdown-it only ships in the browser build (Tauri renders with comrak), so it loads on first use. */
const lazyDemoRenderer: MarkdownRenderer = {
  render: async (markdown) => {
    const { DemoRenderer } = await import('./infrastructure/memory/demoRenderer');
    return new DemoRenderer().render(markdown);
  },
};

/** In a plain browser: an in-memory demo workspace, opened on first run. */
const memoryPorts = (contextMenu: ContextMenu): Ports => {
  const services = createMemoryServices();
  seedDemo(services.fs, services.assetUrls);
  services.preferences.raw ??= { lastFolder: DEMO_FOLDER, lastFile: `${DEMO_FOLDER}/Welcome.md` };
  return {
    ...services,
    renderer: lazyDemoRenderer,
    opener: new BrowserOpener(),
    appInfo: new MemoryAppInfo(),
    menu: new MemoryMenu(),
    dialogs: new BrowserDialogs(),
    contextMenu,
    store: services.preferences,
    dropTarget: new BrowserDropTarget(services.fs),
    printer: new BrowserPrinter(),
    pdfExporter: new BrowserPdfExporter(),
  };
};

/** macOS and Windows file systems ignore case; Linux ones do not. */
const hostIgnoresCase = (): boolean =>
  typeof navigator !== 'undefined' && !/linux/i.test(navigator.userAgent);

export const createContainer = ({
  notifier,
  t,
  fallbackContextMenu,
  mode = isTauri() ? 'tauri' : 'memory',
}: ContainerOptions): Container => {
  const ports = mode === 'tauri' ? tauriPorts(t) : memoryPorts(fallbackContextMenu);
  const caseInsensitive = mode === 'tauri' && hostIgnoresCase();
  const { fs, dialogs, window, watcher, renderer, store, openRequests, opener } = ports;
  return {
    documents: createDocuments({ fs, dialogs, window, watcher, notifier, t, caseInsensitive }),
    workspace: createWorkspace({ fs, dialogs, notifier, t, caseInsensitive }),
    drop: createDrop({ fs, notifier, t }),
    images: createImages({ fs, notifier, t }),
    preferences: createPreferences({ store, notifier, t }),
    printing: createPrinting({
      dialogs,
      printer: ports.printer,
      exporter: ports.pdfExporter,
      notifier,
      t,
    }),
    watcher,
    renderer,
    assetUrls: ports.assetUrls,
    openRequests,
    opener,
    window,
    appInfo: ports.appInfo,
    menu: ports.menu,
    dropTarget: ports.dropTarget,
    dragOut: ports.dragOut,
    contextMenu: ports.contextMenu,
  };
};
